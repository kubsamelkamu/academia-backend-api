import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma, TenantStatus, UserStatus } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { ROLES } from '../../../common/constants/roles.constants';
import { asTenantConfig } from '../../../common/types/tenant-config.types';
import {
  InsufficientPermissionsException,
  TenantDomainAlreadyExistsException,
  TenantNotFoundException,
  UnauthorizedAccessException,
} from '../../../common/exceptions';
import { AdminCreateTenantDto } from './dto/admin-create-tenant.dto';
import { AdminUpdateTenantDto } from './dto/admin-update-tenant.dto';
import { AdminTenantOverviewQueryDto } from './dto/admin-tenant-overview.query';
import { AdminUpdateTenantAddressDto } from './dto/admin-update-tenant-address.dto';

@Injectable()
export class AdminTenantsService {
  private static readonly DEFAULT_LIMIT = 10;
  private readonly logger = new Logger(AdminTenantsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private sanitizeTenantConfigForAdminWrite(config: Record<string, any> | undefined) {
    if (!config) return undefined;
    if (typeof config !== 'object' || Array.isArray(config)) return undefined;

    // Creator metadata is immutable: strip admin-provided overrides.
    // (Creator is persisted from the institution registration flow.)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { createdBy, createdByUserId, ...rest } = config as any;
    return rest as Record<string, any>;
  }

  private mergeTenantConfigPreserveCreator(existingConfig: unknown, updates: Record<string, any>) {
    const existing = asTenantConfig(existingConfig);
    const sanitizedUpdates = this.sanitizeTenantConfigForAdminWrite(updates) ?? {};

    const merged = {
      ...existing,
      ...sanitizedUpdates,
    } as any;

    if (existing.createdByUserId) merged.createdByUserId = existing.createdByUserId;
    if (existing.createdBy) merged.createdBy = existing.createdBy;

    return merged as Record<string, any>;
  }

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
    const { userId } = this.assertPlatformAdmin(params.user);
    this.logger.log(
      `List tenants (adminUserId=${userId}, page=${params.page ?? 1}, limit=${
        params.limit ?? AdminTenantsService.DEFAULT_LIMIT
      })`
    );

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
    const { userId } = this.assertPlatformAdmin(user);

    const domain = dto.domain.trim().toLowerCase();

    this.logger.log(`Create tenant requested (adminUserId=${userId}, domain=${domain})`);

    let created;
    try {
      created = await this.prisma.tenant.create({
        data: {
          name: dto.name.trim(),
          domain,
          config: this.sanitizeTenantConfigForAdminWrite(dto.config),
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
    const { userId } = this.assertPlatformAdmin(user);
    this.logger.log(`Get tenant by id (adminUserId=${userId}, tenantId=${tenantId})`);

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
    const { userId } = this.assertPlatformAdmin(user);
    this.logger.log(`Update tenant requested (adminUserId=${userId}, tenantId=${tenantId})`);

    let config: Record<string, any> | undefined;
    if (dto.config !== undefined) {
      const existing = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, config: true },
      });

      if (!existing) {
        throw new TenantNotFoundException();
      }

      config = this.mergeTenantConfigPreserveCreator(existing.config, dto.config);
    }

    const data: Prisma.TenantUpdateInput = {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.domain !== undefined ? { domain: dto.domain.trim().toLowerCase() } : {}),
      ...(dto.config !== undefined ? { config } : {}),
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

  async updateTenantAddress(user: any, tenantId: string, dto: AdminUpdateTenantAddressDto) {
    const { userId } = this.assertPlatformAdmin(user);
    this.logger.log(`Update tenant address (adminUserId=${userId}, tenantId=${tenantId})`);

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

    const existingConfig = asTenantConfig(tenant.config);
    const existingAddress = (existingConfig.address ?? {}) as any;

    const addressUpdate: Record<string, any> = {
      ...(dto.country !== undefined ? { country: dto.country.trim() } : {}),
      ...(dto.city !== undefined ? { city: dto.city.trim() } : {}),
      ...(dto.region !== undefined ? { region: dto.region.trim() } : {}),
      ...(dto.street !== undefined ? { street: dto.street.trim() } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone.trim() } : {}),
      ...(dto.website !== undefined ? { website: dto.website.trim() } : {}),
    };

    const newConfig = {
      ...existingConfig,
      address: {
        ...existingAddress,
        ...addressUpdate,
      },
    } as any;

    // Preserve immutable creator metadata.
    if (existingConfig.createdByUserId) newConfig.createdByUserId = existingConfig.createdByUserId;
    if (existingConfig.createdBy) newConfig.createdBy = existingConfig.createdBy;

    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: { config: newConfig },
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
  }

  async getTenantOverview(user: any, tenantId: string, query: AdminTenantOverviewQueryDto) {
    const { userId } = this.assertPlatformAdmin(user);
    this.logger.log(
      `Tenant overview (adminUserId=${userId}, tenantId=${tenantId}, includeInactive=${
        query.includeInactive ? 'true' : 'false'
      }, roleName=${query.roleName ?? ''})`
    );

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

    const includeInactive = query.includeInactive === true;
    const statuses: UserStatus[] | undefined = includeInactive ? undefined : [UserStatus.ACTIVE];

    const cfg = asTenantConfig(tenant.config);
    const creatorUserId = cfg.createdByUserId ?? cfg.createdBy?.userId;
    const address = cfg.address ?? null;

    const [creatorUser, departments, totalUsers, userCountsByDepartment] = await Promise.all([
      creatorUserId
        ? this.prisma.user.findFirst({
            where: { id: creatorUserId, tenantId: tenant.id },
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              status: true,
              createdAt: true,
            },
          })
        : Promise.resolve(null),
      this.prisma.department.findMany({
        where: { tenantId: tenant.id },
        orderBy: [{ createdAt: 'asc' }],
        select: {
          id: true,
          name: true,
          code: true,
          headOfDepartmentId: true,
          head: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.user.count({
        where: {
          tenantId: tenant.id,
          ...(statuses ? { status: { in: statuses } } : {}),
        },
      }),
      this.prisma.user.groupBy({
        by: ['departmentId'],
        where: {
          tenantId: tenant.id,
          departmentId: { not: null },
          ...(statuses ? { status: { in: statuses } } : {}),
        },
        _count: { _all: true },
      }),
    ]);

    const deptTotals = new Map<string, number>();
    for (const row of userCountsByDepartment) {
      if (row.departmentId) deptTotals.set(row.departmentId, row._count._all);
    }

    let roleStats:
      | {
          roleName: string;
          totalUsersWithRole: number;
          usersWithRoleByDepartment: Map<string, number>;
        }
      | undefined;

    if (query.roleName) {
      const role = await this.prisma.role.findUnique({
        where: { name: query.roleName },
        select: { id: true, name: true },
      });

      if (!role) {
        throw new BadRequestException('Role not found');
      }

      const [totalUsersWithRole, roleCountsByDepartment] = await Promise.all([
        this.prisma.userRole.count({
          where: {
            tenantId: tenant.id,
            roleId: role.id,
            revokedAt: null,
            ...(statuses
              ? {
                  user: {
                    status: { in: statuses },
                  },
                }
              : {}),
          },
        }),
        this.prisma.userRole.groupBy({
          by: ['departmentId'],
          where: {
            tenantId: tenant.id,
            roleId: role.id,
            revokedAt: null,
            departmentId: { not: null },
            ...(statuses
              ? {
                  user: {
                    status: { in: statuses },
                  },
                }
              : {}),
          },
          _count: { userId: true },
        }),
      ]);

      const usersWithRoleByDepartment = new Map<string, number>();
      for (const row of roleCountsByDepartment) {
        if (row.departmentId) usersWithRoleByDepartment.set(row.departmentId, row._count.userId);
      }

      roleStats = {
        roleName: role.name,
        totalUsersWithRole,
        usersWithRoleByDepartment,
      };
    }

    return {
      tenant,
      creator: creatorUser ?? cfg.createdBy ?? null,
      address,
      stats: {
        includeInactive,
        totalUsers,
        ...(roleStats
          ? {
              roleName: roleStats.roleName,
              totalUsersWithRole: roleStats.totalUsersWithRole,
            }
          : {}),
        departments: departments.map((d) => ({
          id: d.id,
          name: d.name,
          code: d.code,
          headOfDepartmentId: d.headOfDepartmentId,
          head: d.head
            ? {
                id: d.head.id,
                email: d.head.email,
                firstName: d.head.firstName,
                lastName: d.head.lastName,
                status: d.head.status,
              }
            : null,
          totalUsers: deptTotals.get(d.id) ?? 0,
          ...(roleStats
            ? {
                usersWithRole: roleStats.usersWithRoleByDepartment.get(d.id) ?? 0,
              }
            : {}),
        })),
      },
    };
  }

  async updateTenantStatus(user: any, tenantId: string, status: TenantStatus) {
    const { userId } = this.assertPlatformAdmin(user);
    this.logger.log(
      `Update tenant status (adminUserId=${userId}, tenantId=${tenantId}, status=${status})`
    );

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
