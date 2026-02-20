import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class TenantRepository {
  constructor(private prisma: PrismaService) {}

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

  async createUser(
    data: {
      email: string;
      firstName: string;
      lastName: string;
      password?: string;
      roleName: string;
    },
    departmentId: string,
    tenantId: string,
    createdBy: string
  ) {
    const hashedPassword = data.password ? await bcrypt.hash(data.password, 12) : null;

    // Get the role
    const role = await this.prisma.role.findUnique({
      where: { name: data.roleName },
    });

    if (!role) {
      throw new BadRequestException(`Role ${data.roleName} not found`);
    }

    return this.prisma.user.create({
      data: {
        tenantId,
        departmentId,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        hashedPassword,
        status: hashedPassword ? 'ACTIVE' : 'PENDING',
        roles: {
          create: {
            roleId: role.id,
            tenantId,
            departmentId,
            assignedBy: createdBy,
          },
        },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        createdAt: true,
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
