import { Injectable } from '@nestjs/common';
import { Prisma, TenantStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ROLES } from '../../../common/constants/roles.constants';
import {
  InsufficientPermissionsException,
  TenantDomainAlreadyExistsException,
  TenantNotFoundException,
  UnauthorizedAccessException,
} from '../../../common/exceptions';
import { AdminCreateTenantDto } from './dto/admin-create-tenant.dto';
import { AdminUpdateTenantDto } from './dto/admin-update-tenant.dto';

@Injectable()
export class AdminTenantsService {
  private static readonly DEFAULT_LIMIT = 10;

  constructor(private readonly prisma: PrismaService) {}

  private assertPlatformAdmin(user: any) {
    if (!user?.sub) {
      throw new UnauthorizedAccessException();
    }

    const roles: string[] = user.roles ?? [];
    if (!roles.includes(ROLES.PLATFORM_ADMIN)) {
      throw new InsufficientPermissionsException();
    }

    return { userId: String(user.sub) };
  }

  async listTenants(params: {
    user: any;
    page?: number;
    limit?: number;
    search?: string;
    status?: TenantStatus;
  }) {
    this.assertPlatformAdmin(params.user);

    const page = params.page ?? 1;
    const limit = params.limit ?? AdminTenantsService.DEFAULT_LIMIT;
    const skip = (page - 1) * limit;

    const where: Prisma.TenantWhereInput = {
      // Hide system tenant from admin listings
      domain: { not: 'system' },
      ...(params.status ? { status: params.status } : {}),
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: 'insensitive' } },
              { domain: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.tenant.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          domain: true,
          status: true,
          onboardingDate: true,
          config: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.tenant.count({ where }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async createTenant(user: any, dto: AdminCreateTenantDto) {
    this.assertPlatformAdmin(user);

    const domain = dto.domain.trim().toLowerCase();

    let created;
    try {
      created = await this.prisma.tenant.create({
        data: {
          name: dto.name.trim(),
          domain,
          config: dto.config,
        },
        select: {
          id: true,
          name: true,
          domain: true,
          status: true,
          onboardingDate: true,
          config: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        const targets: string[] = Array.isArray(e?.meta?.target)
          ? (e.meta.target as string[])
          : Array.isArray(e?.meta?.driverAdapterError?.cause?.constraint?.fields)
            ? (e.meta.driverAdapterError.cause.constraint.fields as string[])
            : [];

        if (targets.includes('domain')) {
          throw new TenantDomainAlreadyExistsException();
        }
      }
      throw e;
    }

    return created;
  }

  async getTenantById(user: any, tenantId: string) {
    this.assertPlatformAdmin(user);

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        domain: true,
        status: true,
        onboardingDate: true,
        config: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!tenant) {
      throw new TenantNotFoundException();
    }

    return tenant;
  }

  async updateTenant(user: any, tenantId: string, dto: AdminUpdateTenantDto) {
    this.assertPlatformAdmin(user);

    const data: Prisma.TenantUpdateInput = {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.domain !== undefined ? { domain: dto.domain.trim().toLowerCase() } : {}),
      ...(dto.config !== undefined ? { config: dto.config } : {}),
    };

    let updated;
    try {
      updated = await this.prisma.tenant.update({
        where: { id: tenantId },
        data,
        select: {
          id: true,
          name: true,
          domain: true,
          status: true,
          onboardingDate: true,
          config: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (e: any) {
      if (e?.code === 'P2025') {
        throw new TenantNotFoundException();
      }
      if (e?.code === 'P2002') {
        const targets: string[] = Array.isArray(e?.meta?.target)
          ? (e.meta.target as string[])
          : Array.isArray(e?.meta?.driverAdapterError?.cause?.constraint?.fields)
            ? (e.meta.driverAdapterError.cause.constraint.fields as string[])
            : [];

        if (targets.includes('domain')) {
          throw new TenantDomainAlreadyExistsException();
        }
      }
      throw e;
    }

    return updated;
  }

  async updateTenantStatus(user: any, tenantId: string, status: TenantStatus) {
    this.assertPlatformAdmin(user);

    let updated;
    try {
      updated = await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { status },
        select: {
          id: true,
          name: true,
          domain: true,
          status: true,
          onboardingDate: true,
          config: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (e: any) {
      if (e?.code === 'P2025') {
        throw new TenantNotFoundException();
      }
      throw e;
    }

    return updated;
  }
}
