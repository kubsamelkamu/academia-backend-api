import { Injectable } from '@nestjs/common';
import { TenantRepository } from './tenant.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { ROLES } from '../../common/constants/roles.constants';
import {
  InsufficientPermissionsException,
  UnauthorizedAccessException,
} from '../../common/exceptions';

@Injectable()
export class TenantService {
  constructor(
    private readonly tenantRepository: TenantRepository,
    private readonly prisma: PrismaService,
  ) {}

  async getCurrentTenant(user: any) {
    if (!user?.tenantId) {
      throw new UnauthorizedAccessException();
    }

    const roles: string[] = user.roles ?? [];
    if (!roles.includes(ROLES.DEPARTMENT_HEAD) && !roles.includes(ROLES.PLATFORM_ADMIN)) {
      throw new InsufficientPermissionsException();
    }

    const tenant = await this.tenantRepository.findTenantById(user.tenantId);
    if (!tenant) {
      throw new UnauthorizedAccessException('Tenant not found');
    }

    return tenant;
  }

  async updateTenantConfig(user: any, config: any) {
    if (!user?.tenantId) {
      throw new UnauthorizedAccessException();
    }

    const roles: string[] = user.roles ?? [];
    if (!roles.includes(ROLES.DEPARTMENT_HEAD) && !roles.includes(ROLES.PLATFORM_ADMIN)) {
      throw new InsufficientPermissionsException();
    }

    return this.tenantRepository.updateTenantConfig(user.tenantId, config);
  }

  async getDepartments(user: any) {
    if (!user?.tenantId) {
      throw new UnauthorizedAccessException();
    }

    const roles: string[] = user.roles ?? [];
    if (!roles.includes(ROLES.DEPARTMENT_HEAD) && !roles.includes(ROLES.PLATFORM_ADMIN)) {
      throw new InsufficientPermissionsException();
    }

    return this.tenantRepository.findDepartmentsByTenant(user.tenantId);
  }

  async createDepartment(user: any, data: { name: string; code: string; description?: string; headOfDepartmentId?: string }) {
    if (!user?.tenantId) {
      throw new UnauthorizedAccessException();
    }

    const roles: string[] = user.roles ?? [];
    if (!roles.includes(ROLES.DEPARTMENT_HEAD) && !roles.includes(ROLES.PLATFORM_ADMIN)) {
      throw new InsufficientPermissionsException();
    }

    // Validate headOfDepartmentId if provided
    if (data.headOfDepartmentId) {
      // TODO: Check if headOfDepartmentId belongs to this tenant and has appropriate role
    }

    return this.tenantRepository.createDepartment(user.tenantId, data);
  }

  async updateDepartment(user: any, departmentId: string, data: { name?: string; code?: string; description?: string; headOfDepartmentId?: string }) {
    if (!user?.tenantId) {
      throw new UnauthorizedAccessException();
    }

    const roles: string[] = user.roles ?? [];
    if (!roles.includes(ROLES.DEPARTMENT_HEAD) && !roles.includes(ROLES.PLATFORM_ADMIN)) {
      throw new InsufficientPermissionsException();
    }

    // Validate headOfDepartmentId if provided
    if (data.headOfDepartmentId) {
      // TODO: Check if headOfDepartmentId belongs to this tenant and has appropriate role
    }

    return this.tenantRepository.updateDepartment(departmentId, user.tenantId, data);
  }

  async getAcademicYears(user: any) {
    if (!user?.tenantId) {
      throw new UnauthorizedAccessException();
    }

    const roles: string[] = user.roles ?? [];
    if (!roles.includes(ROLES.DEPARTMENT_HEAD) && !roles.includes(ROLES.PLATFORM_ADMIN)) {
      throw new InsufficientPermissionsException();
    }

    return this.tenantRepository.findAcademicYearsByTenant(user.tenantId);
  }

  async createAcademicYear(user: any, data: { name: string; startDate: Date; endDate: Date; description?: string; config?: any }) {
    if (!user?.tenantId) {
      throw new UnauthorizedAccessException();
    }

    const roles: string[] = user.roles ?? [];
    if (!roles.includes(ROLES.DEPARTMENT_HEAD) && !roles.includes(ROLES.PLATFORM_ADMIN)) {
      throw new InsufficientPermissionsException();
    }

    // Validate date range
    if (data.startDate >= data.endDate) {
      throw new Error('Start date must be before end date');
    }

    return this.tenantRepository.createAcademicYear(user.tenantId, data);
  }

  async updateAcademicYear(user: any, academicYearId: string, data: { name?: string; startDate?: Date; endDate?: Date; isActive?: boolean; description?: string; config?: any }) {
    if (!user?.tenantId) {
      throw new UnauthorizedAccessException();
    }

    const roles: string[] = user.roles ?? [];
    if (!roles.includes(ROLES.DEPARTMENT_HEAD) && !roles.includes(ROLES.PLATFORM_ADMIN)) {
      throw new InsufficientPermissionsException();
    }

    // Validate date range if both dates are provided
    if (data.startDate && data.endDate && data.startDate >= data.endDate) {
      throw new Error('Start date must be before end date');
    }

    return this.tenantRepository.updateAcademicYear(academicYearId, user.tenantId, data);
  }

  async getDepartmentUsers(user: any) {
    // Only department head can access users in their department
    if (!user.roles.includes(ROLES.DEPARTMENT_HEAD)) {
      throw new InsufficientPermissionsException();
    }

    // Get user's department
    const userRecord = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { departmentId: true },
    });

    if (!userRecord?.departmentId) {
      throw new Error('User is not assigned to a department');
    }

    return this.tenantRepository.getDepartmentUsers(userRecord.departmentId, user.tenantId);
  }

  async getUserById(user: any, userId: string) {
    // Only department head can access users in their department
    if (!user.roles.includes(ROLES.DEPARTMENT_HEAD)) {
      throw new InsufficientPermissionsException();
    }

    // Get user's department
    const userRecord = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { departmentId: true },
    });

    if (!userRecord?.departmentId) {
      throw new Error('User is not assigned to a department');
    }

    const userData = await this.tenantRepository.getUserById(userId, userRecord.departmentId, user.tenantId);
    if (!userData) {
      throw new Error('User not found in your department');
    }

    return userData;
  }

  async createUser(user: any, data: {
    email: string;
    firstName: string;
    lastName: string;
    password?: string;
    roleName: string;
  }) {
    // Only department head can create users in their department
    if (!user.roles.includes(ROLES.DEPARTMENT_HEAD)) {
      throw new InsufficientPermissionsException();
    }

    // Get user's department
    const userRecord = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { departmentId: true },
    });

    if (!userRecord?.departmentId) {
      throw new Error('User is not assigned to a department');
    }

    // Validate role - department head can only create students, advisors, coordinators
    const allowedRoles = [ROLES.STUDENT, ROLES.ADVISOR, ROLES.COORDINATOR];
    if (!allowedRoles.includes(data.roleName as any)) {
      throw new Error('Department head can only create students, advisors, or coordinators');
    }

    // Check if email already exists in tenant
    const existingUser = await this.prisma.user.findUnique({
      where: {
        tenantId_email: {
          tenantId: user.tenantId,
          email: data.email,
        },
      },
    });

    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    return this.tenantRepository.createUser(data, userRecord.departmentId, user.tenantId, user.sub);
  }

  async updateUser(user: any, userId: string, data: {
    firstName?: string;
    lastName?: string;
    email?: string;
  }) {
    // Only department head can update users in their department
    if (!user.roles.includes(ROLES.DEPARTMENT_HEAD)) {
      throw new InsufficientPermissionsException();
    }

    // Get user's department
    const userRecord = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { departmentId: true },
    });

    if (!userRecord?.departmentId) {
      throw new Error('User is not assigned to a department');
    }

    // Check if email is being updated and if it's unique
    if (data.email) {
      const existingUser = await this.prisma.user.findFirst({
        where: {
          tenantId: user.tenantId,
          email: data.email,
          id: { not: userId },
        },
      });

      if (existingUser) {
        throw new Error('User with this email already exists');
      }
    }

    return this.tenantRepository.updateUser(userId, data, userRecord.departmentId, user.tenantId);
  }

  async deactivateUser(user: any, userId: string) {
    // Only department head can deactivate users in their department
    if (!user.roles.includes(ROLES.DEPARTMENT_HEAD)) {
      throw new InsufficientPermissionsException();
    }

    // Get user's department
    const userRecord = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { departmentId: true },
    });

    if (!userRecord?.departmentId) {
      throw new Error('User is not assigned to a department');
    }

    // Cannot deactivate themselves
    if (userId === user.sub) {
      throw new Error('Cannot deactivate your own account');
    }

    return this.tenantRepository.deactivateUser(userId, userRecord.departmentId, user.tenantId);
  }
}