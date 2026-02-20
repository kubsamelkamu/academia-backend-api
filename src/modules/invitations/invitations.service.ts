import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';

import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../core/email/email.service';
import { QueueService } from '../../core/queue/queue.service';

const maskEmailForLogs = (value: string): string => {
  const email = (value ?? '').trim();
  const at = email.indexOf('@');
  if (at <= 1) return '***';
  const name = email.slice(0, at);
  const domain = email.slice(at + 1);
  return `${name[0]}***@${domain}`;
};

@Injectable()
export class InvitationsService {
  private readonly logger = new Logger(InvitationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
    private readonly queueService: QueueService
  ) {}

  async createInvitation(params: {
    tenantId: string;
    departmentId?: string;
    email: string;
    roleName: string;
    invitedByAdminId?: string;
  }) {
    const expiryDays = this.config.get<number>('email.invitationExpiryDays') || 7;
    const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

    const role = await this.prisma.role.findFirst({ where: { name: params.roleName } });
    if (!role) {
      throw new BadRequestException(`Role not found: ${params.roleName}`);
    }

    const token = randomBytes(32).toString('hex');

    const email = params.email.toLowerCase();

    const invitation = await this.prisma.$transaction(async (tx) => {
      // Keep one active pending invite per (tenant, email, role, department) to avoid confusion.
      await tx.invitation.updateMany({
        where: {
          tenantId: params.tenantId,
          email,
          roleId: role.id,
          departmentId: params.departmentId ?? null,
          status: 'PENDING',
        },
        data: { status: 'REVOKED' },
      });

      return tx.invitation.create({
        data: {
          tenantId: params.tenantId,
          departmentId: params.departmentId,
          email,
          roleId: role.id,
          token,
          status: 'PENDING',
          expiresAt,
          invitedById: params.invitedByAdminId,
        },
      });
    });

    const frontendBase = (
      this.config.get<string>('app.frontendUrl') || 'http://localhost:3000'
    ).replace(/\/$/, '');
    const acceptUrl = `${frontendBase}/invitations/accept?token=${invitation.token}`;

    try {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: params.tenantId },
        select: { id: true, name: true, domain: true },
      });
      const department = params.departmentId
        ? await this.prisma.department.findUnique({
            where: { id: params.departmentId },
            select: { id: true, name: true },
          })
        : null;

      const loginUrl = tenant?.domain
        ? `${frontendBase}/login?tenantDomain=${encodeURIComponent(tenant.domain)}`
        : `${frontendBase}/login`;

      const emailJob = {
        to: { email },
        subject: `You're invited to join ${tenant?.name ?? 'Academia'}`,
        htmlContent: `<p>Hello,</p>
      <p>You have been invited to join <b>${tenant?.name ?? 'Academia'}</b> as <b>${params.roleName}</b>${department?.name ? ` in <b>${department.name}</b>` : ''}.</p>
      ${tenant?.domain ? `<p><b>Tenant domain:</b> ${tenant.domain}</p>` : ''}
      <p>Accept invitation: <a href="${acceptUrl}">${acceptUrl}</a></p>
      <p>After accepting, you can login here: <a href="${loginUrl}">${loginUrl}</a></p>
      <p>This invitation expires on <b>${invitation.expiresAt.toDateString()}</b>.</p>`,
        textContent: `You have been invited to join ${tenant?.name ?? 'Academia'} as ${params.roleName}${department?.name ? ` in ${department.name}` : ''}.${tenant?.domain ? ` Tenant domain: ${tenant.domain}.` : ''} Accept: ${acceptUrl}. Login: ${loginUrl}. Expires: ${invitation.expiresAt.toDateString()}.`,
      };

      try {
        const workerEnabled = (process.env.WORKER ?? '').toLowerCase() === 'true';
        const isDev = (process.env.NODE_ENV ?? 'development').toLowerCase() !== 'production';

        if (workerEnabled) {
          this.logger.log(
            `InvitationEmail: enqueue to=${maskEmailForLogs(email)} tenant=${params.tenantId} dept=${params.departmentId ?? 'none'}`
          );
          await this.queueService.addTransactionalEmailJob(emailJob);
        } else if (isDev) {
          this.logger.warn(
            `InvitationEmail: WORKER not enabled; sending directly to=${maskEmailForLogs(email)} tenant=${params.tenantId}`
          );
          await this.email.sendTransactionalEmail(emailJob);
        } else {
          this.logger.log(
            `InvitationEmail: enqueue (non-worker) to=${maskEmailForLogs(email)} tenant=${params.tenantId}`
          );
          await this.queueService.addTransactionalEmailJob(emailJob);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `InvitationEmail: failed send/enqueue to=${maskEmailForLogs(email)} tenant=${params.tenantId} (${message})`
        );

        // Fallback: direct-send
        await this.email.sendTransactionalEmail(emailJob);
      }
    } catch {
      // Email sending is best-effort; invitation remains valid.
    }

    return invitation;
  }

  async acceptInvitation(params: {
    token: string;
    password: string;
    firstName: string;
    lastName: string;
  }) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token: params.token },
      select: {
        id: true,
        tenantId: true,
        departmentId: true,
        email: true,
        roleId: true,
        status: true,
        expiresAt: true,
      },
    });

    if (!invitation) {
      throw new BadRequestException('Invalid invitation token');
    }
    if (invitation.status !== 'PENDING') {
      throw new BadRequestException('Invitation is not pending');
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      // Mark expired for bookkeeping.
      await this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
      });
      throw new BadRequestException('Invitation has expired');
    }

    const email = invitation.email.toLowerCase();

    // Create (or reuse) the user in this tenant by email.
    const existingUser = await this.prisma.user.findFirst({
      where: { tenantId: invitation.tenantId, email },
      select: { id: true },
    });

    const rounds = this.config.get<number>('auth.bcryptRounds') || 12;
    const passwordHash = await bcrypt.hash(params.password, rounds);

    const result = await this.prisma.$transaction(async (tx) => {
      const user = existingUser
        ? await tx.user.update({
            where: { id: existingUser.id },
            data: {
              // Allow invitation acceptance to "activate" a pending user
              hashedPassword: passwordHash,
              firstName: params.firstName,
              lastName: params.lastName,
              status: 'ACTIVE',
              emailVerified: true,
              ...(invitation.departmentId ? { departmentId: invitation.departmentId } : {}),
            },
            select: { id: true, tenantId: true, email: true },
          })
        : await tx.user.create({
            data: {
              tenantId: invitation.tenantId,
              departmentId: invitation.departmentId,
              email,
              hashedPassword: passwordHash,
              firstName: params.firstName,
              lastName: params.lastName,
              status: 'ACTIVE',
              emailVerified: true,
            },
            select: { id: true, tenantId: true, email: true },
          });

      await tx.userRole.upsert({
        where: {
          userId_roleId_tenantId: {
            userId: user.id,
            roleId: invitation.roleId,
            tenantId: invitation.tenantId,
          },
        },
        update: {
          revokedAt: null,
          ...(invitation.departmentId ? { departmentId: invitation.departmentId } : {}),
        },
        create: {
          userId: user.id,
          roleId: invitation.roleId,
          tenantId: invitation.tenantId,
          departmentId: invitation.departmentId,
        },
      });

      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED' },
      });

      // Finalize any pending department head assignment originating from this invitation.
      const departments = await tx.department.findMany({
        where: { tenantId: invitation.tenantId },
        select: { id: true, config: true },
      });

      const updatedDepartmentIds: string[] = [];
      for (const dept of departments) {
        const cfg: any = dept.config ?? {};
        const pending = cfg?.pendingHead;
        if (!pending || pending.invitationId !== invitation.id) continue;

        await tx.department.update({
          where: { id: dept.id },
          data: {
            headOfDepartmentId: user.id,
            config: {
              ...cfg,
              pendingHead: null,
            },
          },
        });
        updatedDepartmentIds.push(dept.id);
      }

      return { user, updatedDepartmentIds };
    });

    return {
      accepted: true,
      userId: result.user.id,
      tenantId: result.user.tenantId,
      updatedDepartmentIds: result.updatedDepartmentIds,
    };
  }
}
