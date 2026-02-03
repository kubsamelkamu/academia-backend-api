import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  async createInvitation(params: {
    tenantId: string;
    email: string;
    roleName: string;
    invitedByAdminId?: string;
  }) {
    const expiryDays = this.config.get<number>('email.invitationExpiryDays') || 7;
    const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

    const role = await this.prisma.role.findFirst({ where: { name: params.roleName } });
    if (!role) {
      throw new Error(`Role not found: ${params.roleName}`);
    }

    const token = randomBytes(32).toString('hex');

    return this.prisma.invitation.create({
      data: {
        tenantId: params.tenantId,
        email: params.email.toLowerCase(),
        roleId: role.id,
        token,
        status: 'PENDING',
        expiresAt,
      },
    });
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

    const passwordHash = await bcrypt.hash(params.password, 10);

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
            },
            select: { id: true, tenantId: true, email: true },
          })
        : await tx.user.create({
            data: {
              tenantId: invitation.tenantId,
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
        update: { revokedAt: null },
        create: {
          userId: user.id,
          roleId: invitation.roleId,
          tenantId: invitation.tenantId,
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
