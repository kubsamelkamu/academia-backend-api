import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { TenantNotFoundException } from '../../../common/exceptions/tenant.exceptions';
import {
  DepartmentCodeAlreadyExistsException,
  DepartmentHeadInvalidTenantException,
  DepartmentHeadNotFoundException,
  DepartmentNotFoundException,
} from '../../../common/exceptions/department.exceptions';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmailService } from '../../../core/email/email.service';
import { InvitationsService } from '../../invitations/invitations.service';
import { AdminCreateDepartmentDto } from './dto/admin-create-department.dto';
import { AdminListDepartmentsQueryDto } from './dto/admin-list-departments.query';
import { AdminSetDepartmentHeadDto } from './dto/admin-set-department-head.dto';
import { AdminSetDepartmentHeadByEmailDto } from './dto/admin-set-department-head-by-email.dto';

@Injectable()
export class AdminDepartmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly invitations: InvitationsService,
    private readonly email: EmailService
  ) {}

  async listForTenant(tenantId: string, query: AdminListDepartmentsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const search = query.search?.trim();

    await this.assertTenantExists(tenantId);

    const where: Prisma.DepartmentWhereInput = {
      tenantId,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.department.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }],
        select: {
          id: true,
          tenantId: true,
          name: true,
          code: true,
          headOfDepartmentId: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.department.count({ where }),
    ]);

    return {
      page,
      limit,
      total,
      items,
    };
  }

  async createForTenant(tenantId: string, dto: AdminCreateDepartmentDto) {
    await this.assertTenantExists(tenantId);

    if (dto.headOfDepartmentId) {
      const head = await this.prisma.user.findUnique({
        where: { id: dto.headOfDepartmentId },
        select: { id: true, tenantId: true },
      });

      if (!head) {
        throw new DepartmentHeadNotFoundException();
      }
      if (head.tenantId !== tenantId) {
        throw new DepartmentHeadInvalidTenantException();
      }
    }

    const code = dto.code.trim();
    const name = dto.name.trim();

    try {
      return await this.prisma.department.create({
        data: {
          tenantId,
          code,
          name,
          ...(dto.headOfDepartmentId ? { headOfDepartmentId: dto.headOfDepartmentId } : {}),
        },
        select: {
          id: true,
          tenantId: true,
          name: true,
          code: true,
          headOfDepartmentId: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (err) {
      if (this.isUniqueTenantCodeViolation(err)) {
        throw new DepartmentCodeAlreadyExistsException();
      }
      throw err;
    }
  }

  async setDepartmentHead(tenantId: string, departmentId: string, dto: AdminSetDepartmentHeadDto) {
    await this.assertTenantExists(tenantId);

    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, tenantId },
      select: { id: true, tenantId: true },
    });

    if (!department) {
      throw new DepartmentNotFoundException();
    }

    // Remove head: allow null/undefined to mean "unset".
    if (!dto.headOfDepartmentId) {
      return this.prisma.department.update({
        where: { id: departmentId },
        data: { headOfDepartmentId: null },
        select: {
          id: true,
          tenantId: true,
          name: true,
          code: true,
          headOfDepartmentId: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    }

    const head = await this.prisma.user.findUnique({
      where: { id: dto.headOfDepartmentId },
      select: { id: true, tenantId: true },
    });

    if (!head) {
      throw new DepartmentHeadNotFoundException();
    }
    if (head.tenantId !== tenantId) {
      throw new DepartmentHeadInvalidTenantException();
    }

    return this.prisma.department.update({
      where: { id: departmentId },
      data: { headOfDepartmentId: head.id },
      select: {
        id: true,
        tenantId: true,
        name: true,
        code: true,
        headOfDepartmentId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async setDepartmentHeadByEmail(
    tenantId: string,
    departmentId: string,
    dto: AdminSetDepartmentHeadByEmailDto
  ) {
    await this.assertTenantExists(tenantId);

    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, tenantId },
      select: {
        id: true,
        tenantId: true,
        name: true,
        code: true,
        headOfDepartmentId: true,
        config: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!department) {
      throw new DepartmentNotFoundException();
    }

    const email = dto.email.toLowerCase();

    const existingUser = await this.prisma.user.findFirst({
      where: { email },
      select: { id: true, tenantId: true },
    });

    if (existingUser) {
      if (existingUser.tenantId !== tenantId) {
        throw new DepartmentHeadInvalidTenantException();
      }

      return this.prisma.department.update({
        where: { id: departmentId },
        data: {
          headOfDepartmentId: existingUser.id,
          config: {
            ...(department.config as any),
            pendingHead: null,
          },
        },
        select: {
          id: true,
          tenantId: true,
          name: true,
          code: true,
          headOfDepartmentId: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    }

    const invitation = await this.invitations.createInvitation({
      tenantId,
      email,
      inviteeFirstName:
        String(dto.fullName ?? '')
          .trim()
          .split(/\s+/)
          .filter(Boolean)[0] || 'Department',
      inviteeLastName:
        String(dto.fullName ?? '')
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .slice(1)
          .join(' ') || 'Head',
      roleName: 'DepartmentHead',
    });

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true },
    });

    const frontendUrl = this.config.get<string>('FRONTEND_URL') || process.env.FRONTEND_URL || '';
    const acceptUrl = `${frontendUrl.replace(/\/$/, '')}/invitations/accept?token=${invitation.token}`;

    const updatedDepartment = await this.prisma.department.update({
      where: { id: departmentId },
      data: {
        config: {
          ...(department.config as any),
          pendingHead: {
            invitationId: invitation.id,
            email,
            fullName: dto.fullName,
            invitedAt: new Date().toISOString(),
          },
        },
      },
      select: {
        id: true,
        tenantId: true,
        name: true,
        code: true,
        headOfDepartmentId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    try {
      await this.email.sendTransactionalEmail({
        to: { email, name: dto.fullName },
        subject: 'You have been invited as Department Head',
        htmlContent: `<p>Hello${dto.fullName ? ` ${dto.fullName}` : ''},</p>
        <p>You have been invited to join <b>${tenant?.name ?? 'Academia'}</b> as a Department Head.</p>
        <p>Accept invitation: <a href="${acceptUrl}">${acceptUrl}</a></p>
        <p>After accepting, a <b>temporary password</b> will be shown once on the confirmation screen. Use it to log in, then you’ll be prompted to set a new password.</p>
        <p><b>Security note:</b> This email contains a sign-in link. Please do not forward it.</p>`,
        textContent: `You have been invited to join ${tenant?.name ?? 'Academia'} as a Department Head. Accept: ${acceptUrl}. After accepting, a temporary password will be shown once. You will be prompted to change your password after first login. Do not forward this email.`,
      });

      return {
        status: 'invited',
        invitationId: invitation.id,
        department: updatedDepartment,
      };
    } catch {
      // Invitation is still valid; admin can manually copy acceptUrl.
      return {
        status: 'invited_email_failed',
        message: 'Invitation created, but email sending failed. Share acceptUrl manually.',
        acceptUrl,
        invitationId: invitation.id,
        department: updatedDepartment,
      };
    }
  }

  private async assertTenantExists(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });

    if (!tenant) {
      throw new TenantNotFoundException(tenantId);
    }
  }

  private isUniqueTenantCodeViolation(err: unknown): boolean {
    // Prisma error shapes vary (esp. adapter-pg), so follow the tenants pattern.
    if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return false;
    if (err.code !== 'P2002') return false;

    const metaAny = err.meta as any;
    const targets: string[] | undefined =
      metaAny?.target ??
      metaAny?.driverAdapterError?.cause?.constraint?.fields ??
      metaAny?.cause?.constraint?.fields;

    if (!targets?.length) return false;
    const normalized = targets.map((t) => String(t)).map((t) => t.replace(/"/g, '').trim());
    return normalized.includes('tenantId') && normalized.includes('code');
  }
}
