import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TenantRepository {
  constructor(private prisma: PrismaService) {}

  private buildDepartmentUsersWhere(params: {
    tenantId: string;
    departmentId: string;
    roleNames?: string[];
    search?: string;
  }) {
    const search = (params.search ?? '').trim();

    return {
      tenantId: params.tenantId,
      departmentId: params.departmentId,
      deletedAt: null,
      ...(params.roleNames?.length
        ? {
            roles: {
              some: {
                role: {
                  name: {
                    in: params.roleNames,
                  },
                },
              },
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' as const } },
              { firstName: { contains: search, mode: 'insensitive' as const } },
              { lastName: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
  }

  async countDepartmentUsers(params: {
    tenantId: string;
    departmentId: string;
    roleNames?: string[];
    search?: string;
  }) {
    return this.prisma.user.count({
      where: this.buildDepartmentUsersWhere(params),
    });
  }

  async findDepartmentUsers(params: {
    tenantId: string;
    departmentId: string;
    roleNames?: string[];
    search?: string;
    skip: number;
    take: number;
  }) {
    return this.prisma.user.findMany({
      where: this.buildDepartmentUsersWhere(params),
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        emailVerified: true,
        lastLoginAt: true,
        createdAt: true,
        roles: {
          include: {
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: params.skip,
      take: params.take,
    });
  }

  async findTenantById(tenantId: string) {
    return this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        domain: true,
        status: true,
        config: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updateTenantConfig(tenantId: string, config: any) {
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: { config },
      select: {
        id: true,
        name: true,
        domain: true,
        status: true,
        config: true,
        updatedAt: true,
      },
    });
  }

  async findDepartmentsByTenant(tenantId: string) {
    return this.prisma.department.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        headOfDepartmentId: true,
        head: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async createDepartment(
    tenantId: string,
    data: { name: string; code: string; description?: string; headOfDepartmentId?: string }
  ) {
    return this.prisma.department.create({
      data: {
        ...data,
        tenantId,
      },
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        headOfDepartmentId: true,
        head: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updateDepartment(
    departmentId: string,
    tenantId: string,
    data: { name?: string; code?: string; description?: string; headOfDepartmentId?: string }
  ) {
    return this.prisma.department.update({
      where: { id: departmentId, tenantId },
      data,
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
        headOfDepartmentId: true,
        head: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        updatedAt: true,
      },
    });
  }

  async findAcademicYearsByTenant(tenantId: string) {
    return this.prisma.academicYear.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        isActive: true,
        description: true,
        config: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { startDate: 'desc' },
    });
  }

  async createAcademicYear(
    tenantId: string,
    data: { name: string; startDate: Date; endDate: Date; description?: string; config?: any }
  ) {
    return this.prisma.academicYear.create({
      data: {
        ...data,
        tenantId,
      },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        isActive: true,
        description: true,
        config: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updateAcademicYear(
    academicYearId: string,
    tenantId: string,
    data: {
      name?: string;
      startDate?: Date;
      endDate?: Date;
      isActive?: boolean;
      description?: string;
      config?: any;
    }
  ) {
    return this.prisma.academicYear.update({
      where: { id: academicYearId, tenantId },
      data,
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
        isActive: true,
        description: true,
        config: true,
        updatedAt: true,
      },
    });
  }

  async getDepartmentUsers(departmentId: string, tenantId: string) {
    return this.prisma.user.findMany({
      where: {
        tenantId,
        departmentId,
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        emailVerified: true,
        lastLoginAt: true,
        createdAt: true,
        roles: {
          include: {
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getUserById(userId: string, departmentId: string, tenantId: string) {
    return this.prisma.user.findFirst({
      where: {
        id: userId,
        tenantId,
        departmentId,
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        status: true,
        emailVerified: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        roles: {
          include: {
            role: true,
          },
        },
      },
    });
  }

  async updateUser(
    userId: string,
    data: {
      firstName?: string;
      lastName?: string;
      email?: string;
    },
    departmentId: string,
    tenantId: string
  ) {
    return this.prisma.user.update({
      where: {
        id: userId,
        tenantId,
        departmentId,
        deletedAt: null,
      },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        updatedAt: true,
      },
    });
  }

  async deactivateUser(userId: string, departmentId: string, tenantId: string) {
    return this.prisma.user.update({
      where: {
        id: userId,
        tenantId,
        departmentId,
        deletedAt: null,
      },
      data: {
        status: 'INACTIVE',
        deletedAt: new Date(),
      },
      select: {
        id: true,
        status: true,
        deletedAt: true,
      },
    });
  }
}
