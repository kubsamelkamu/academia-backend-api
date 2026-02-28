import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DepartmentGroupSizeSettingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByDepartmentId(departmentId: string) {
    return this.prisma.departmentGroupSizeSetting.findUnique({
      where: { departmentId },
      select: {
        departmentId: true,
        minGroupSize: true,
        maxGroupSize: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async upsertByDepartmentId(params: {
    departmentId: string;
    minGroupSize: number;
    maxGroupSize: number;
    actorUserId?: string;
  }) {
    const { departmentId, minGroupSize, maxGroupSize, actorUserId } = params;

    return this.prisma.departmentGroupSizeSetting.upsert({
      where: { departmentId },
      update: {
        minGroupSize,
        maxGroupSize,
        updatedById: actorUserId,
      },
      create: {
        departmentId,
        minGroupSize,
        maxGroupSize,
        createdById: actorUserId,
        updatedById: actorUserId,
      },
      select: {
        departmentId: true,
        minGroupSize: true,
        maxGroupSize: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findUserDepartmentContext(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        tenantId: true,
        departmentId: true,
      },
    });
  }

  async departmentExistsInTenant(departmentId: string, tenantId: string) {
    const department = await this.prisma.department.findFirst({
      where: {
        id: departmentId,
        tenantId,
      },
      select: { id: true },
    });

    return Boolean(department);
  }

  async findDepartmentById(departmentId: string) {
    return this.prisma.department.findUnique({
      where: { id: departmentId },
      select: {
        id: true,
        tenantId: true,
        name: true,
      },
    });
  }

  async findDepartmentUserIds(departmentId: string, tenantId: string) {
    const users = await this.prisma.user.findMany({
      where: {
        tenantId,
        departmentId,
        deletedAt: null,
      },
      select: { id: true },
    });

    return users.map((u) => u.id);
  }
}
