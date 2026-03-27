import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ROLES } from '../../common/constants/roles.constants';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';

import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../core/email/email.service';
import { QueueService } from '../../core/queue/queue.service';
import { buildInvitationEmailContent } from './invitation-email-content';

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

  async sendInvitationEmail(params: {
    invitationId?: string;
    tenantId: string;
    departmentId?: string | null;
    email: string;
    inviteeFirstName?: string;
    inviteeLastName?: string;
    roleName: string;
    token: string;
    expiresAt: Date;
    customSubject?: string;
    customMessage?: string;
  }): Promise<void> {
    const email = (params.email ?? '').toLowerCase();
    const frontendBase = (
      this.config.get<string>('app.frontendUrl') || 'http://localhost:3000'
    ).replace(/\/$/, '');

    const acceptUrl = `${frontendBase}/invitations/accept?token=${params.token}`;

    let dispatched = false;
    let lastError: string | undefined;

    try {
      let inviteeFirstName = (params.inviteeFirstName ?? '').trim();
      let inviteeLastName = (params.inviteeLastName ?? '').trim();

      if ((!inviteeFirstName || !inviteeLastName) && params.invitationId) {
        try {
          const inv = await this.prisma.invitation.findUnique({
            where: { id: params.invitationId },
            select: { inviteeFirstName: true, inviteeLastName: true },
          });
          inviteeFirstName = inviteeFirstName || (inv?.inviteeFirstName ?? '').trim();
          inviteeLastName = inviteeLastName || (inv?.inviteeLastName ?? '').trim();
        } catch {
          // Best-effort; email can still be sent without personalization.
        }
      }

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

      const templateId = this.config.get<number>('email.invitationTemplateId');

      const built = buildInvitationEmailContent({
        commonTemplateParams: this.email.getCommonTemplateParams(),
        tenantName: tenant?.name ?? 'Academia',
        tenantDomain: tenant?.domain ?? undefined,
        inviteeFirstName: inviteeFirstName || undefined,
        inviteeLastName: inviteeLastName || undefined,
        roleName: params.roleName,
        departmentName: department?.name ?? undefined,
        acceptUrl,
        loginUrl,
        expiresAt: params.expiresAt,
        customSubject: params.customSubject,
        customMessage: params.customMessage,
      });

      const templateParams = built.templateParams;

      const emailJob = {
        to: { email },
        subject: built.subject,
        htmlContent: built.htmlContent,
        textContent: built.textContent,
      };

      try {
        const workerEnabled = (process.env.WORKER ?? '').toLowerCase() === 'true';
        const isDev = (process.env.NODE_ENV ?? 'development').toLowerCase() !== 'production';

        if (workerEnabled) {
          this.logger.log(
            `InvitationEmail: enqueue to=${maskEmailForLogs(email)} tenant=${params.tenantId} dept=${params.departmentId ?? 'none'}`
          );
          if (templateId) {
            await this.queueService.addTransactionalTemplateEmailJob({
              to: emailJob.to,
              templateId,
              params: templateParams,
            });
          } else {
            await this.queueService.addTransactionalEmailJob(emailJob);
          }
          dispatched = true;
        } else if (isDev) {
          this.logger.warn(
            `InvitationEmail: WORKER not enabled; sending directly to=${maskEmailForLogs(email)} tenant=${params.tenantId}`
          );
          if (templateId) {
            await this.email.sendTransactionalTemplateEmail({
              to: emailJob.to,
              templateId,
              params: templateParams,
            });
          } else {
            await this.email.sendTransactionalEmail(emailJob);
          }
          dispatched = true;
        } else {
          this.logger.log(
            `InvitationEmail: enqueue (non-worker) to=${maskEmailForLogs(email)} tenant=${params.tenantId}`
          );
          if (templateId) {
            await this.queueService.addTransactionalTemplateEmailJob({
              to: emailJob.to,
              templateId,
              params: templateParams,
            });
          } else {
            await this.queueService.addTransactionalEmailJob(emailJob);
          }
          dispatched = true;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `InvitationEmail: failed send/enqueue to=${maskEmailForLogs(email)} tenant=${params.tenantId} (${message})`
        );

        lastError = message;

        try {
          // Fallback: direct-send
          if (templateId) {
            await this.email.sendTransactionalTemplateEmail({
              to: emailJob.to,
              templateId,
              params: templateParams,
            });
          } else {
            await this.email.sendTransactionalEmail(emailJob);
          }
          dispatched = true;
          lastError = undefined;
        } catch (fallbackErr) {
          const fallbackMessage =
            fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
          lastError = fallbackMessage;
        }
      }
    } catch {
      // Best-effort: do not block invitation lifecycle on email failures.
      if (!lastError) {
        lastError = 'Unknown error while preparing invitation email';
      }
    } finally {
      if (params.invitationId) {
        try {
          if (dispatched) {
            await this.prisma.invitation.update({
              where: { id: params.invitationId },
              data: {
                lastSentAt: new Date(),
                sendCount: { increment: 1 },
                lastSendError: null,
              },
            });
          } else if (lastError) {
            await this.prisma.invitation.update({
              where: { id: params.invitationId },
              data: {
                lastSendError: lastError.slice(0, 500),
              },
            });
          }
        } catch {
          // Best-effort audit update.
        }
      }
    }
  }

  async createInvitation(params: {
    tenantId: string;
    departmentId?: string;
    email: string;
    inviteeFirstName: string;
    inviteeLastName: string;
    roleName: string;
    invitedByAdminId?: string;
    customSubject?: string;
    customMessage?: string;
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
        data: {
          status: 'REVOKED',
          revokedAt: new Date(),
          revokedById: params.invitedByAdminId ?? null,
        },
      });

      return tx.invitation.create({
        data: {
          tenantId: params.tenantId,
          departmentId: params.departmentId,
          email,
          inviteeFirstName: params.inviteeFirstName.trim(),
          inviteeLastName: params.inviteeLastName.trim(),
          roleId: role.id,
          token,
          status: 'PENDING',
          expiresAt,
          invitedById: params.invitedByAdminId,
        },
      });
    });

    await this.sendInvitationEmail({
      invitationId: invitation.id,
      tenantId: invitation.tenantId,
      departmentId: invitation.departmentId,
      email: invitation.email,
      inviteeFirstName: invitation.inviteeFirstName ?? undefined,
      inviteeLastName: invitation.inviteeLastName ?? undefined,
      roleName: params.roleName,
      token: invitation.token,
      expiresAt: invitation.expiresAt,
      customSubject: params.customSubject,
      customMessage: params.customMessage,
    });

    // Re-fetch to return updated audit fields (sendCount/lastSentAt/lastSendError)
    // which may be updated by sendInvitationEmail().
    const refreshed = await this.prisma.invitation.findUnique({
      where: { id: invitation.id },
    });

    return refreshed ?? invitation;
  }

  async previewAcceptInvitation(params: { token: string }) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token: params.token },
      select: {
        id: true,
        tenantId: true,
        departmentId: true,
        email: true,
        inviteeFirstName: true,
        inviteeLastName: true,
        status: true,
        expiresAt: true,
        role: { select: { name: true } },
        tenant: { select: { name: true, domain: true } },
        department: { select: { name: true } },
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

    const firstName = (invitation.inviteeFirstName ?? '').trim();
    const lastName = (invitation.inviteeLastName ?? '').trim();
    if (!firstName || !lastName) {
      throw new BadRequestException('Invitation is missing invitee name');
    }

    return {
      invitationId: invitation.id,
      tenantId: invitation.tenantId,
      tenantName: invitation.tenant?.name,
      tenantDomain: invitation.tenant?.domain,
      departmentId: invitation.departmentId,
      departmentName: invitation.department?.name,
      roleName: invitation.role?.name,
      email: invitation.email,
      firstName,
      lastName,
      expiresAt: invitation.expiresAt.toISOString(),
    };
  }

  async acceptInvitation(params: { token: string }) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { token: params.token },
      select: {
        id: true,
        tenantId: true,
        departmentId: true,
        email: true,
        inviteeFirstName: true,
        inviteeLastName: true,
        roleId: true,
        role: { select: { name: true } },
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

    const firstName = (invitation.inviteeFirstName ?? '').trim();
    const lastName = (invitation.inviteeLastName ?? '').trim();
    if (!firstName || !lastName) {
      throw new BadRequestException('Invitation is missing invitee name');
    }

    // Create (or reuse) the user in this tenant by email.
    const existingUser = await this.prisma.user.findFirst({
      where: { tenantId: invitation.tenantId, email },
      select: { id: true },
    });

    const rounds = this.config.get<number>('auth.bcryptRounds') || 12;
    const temporaryPassword = randomBytes(9).toString('base64url');
    const passwordHash = await bcrypt.hash(temporaryPassword, rounds);

    const result = await this.prisma.$transaction(async (tx) => {
      const user = existingUser
        ? await tx.user.update({
            where: { id: existingUser.id },
            data: {
              // Allow invitation acceptance to "activate" a pending user
              hashedPassword: passwordHash,
              mustChangePassword: true,
              firstName,
              lastName,
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
              mustChangePassword: true,
              firstName,
              lastName,
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

      if (invitation.role?.name === ROLES.ADVISOR && invitation.departmentId) {
        await tx.advisor.upsert({
          where: { userId: user.id },
          update: {
            departmentId: invitation.departmentId,
          },
          create: {
            userId: user.id,
            departmentId: invitation.departmentId,
          },
        });
      }

      await tx.invitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED', acceptedAt: new Date() },
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
      email: result.user.email,
      temporaryPassword,
      mustChangePassword: true,
      updatedDepartmentIds: result.updatedDepartmentIds,
    };
  }
}
