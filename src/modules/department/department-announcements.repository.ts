import { Injectable } from '@nestjs/common';
import { ROLES } from '../../common/constants/roles.constants';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DepartmentAnnouncementsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get prismaClient(): any {
    return this.prisma as any;
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

  async findDepartmentStudentUserIds(departmentId: string, tenantId: string) {
    const users = await this.prisma.user.findMany({
      where: {
        tenantId,
        departmentId,
        deletedAt: null,
        roles: {
          some: {
            role: {
              name: ROLES.STUDENT,
            },
          },
        },
      },
      select: { id: true },
    });

    return users.map((u) => u.id);
  }

  async createAnnouncement(params: {
    tenantId: string;
    departmentId: string;
    createdByUserId: string;
    title: string;
    message: string;
    actionType: string;
    actionLabel?: string;
    actionUrl?: string;
    deadlineAt?: Date;
  }) {
    return this.prismaClient.departmentAnnouncement.create({
      data: {
        tenantId: params.tenantId,
        departmentId: params.departmentId,
        createdByUserId: params.createdByUserId,
        title: params.title,
        message: params.message,
        actionType: params.actionType as any,
        actionLabel: params.actionLabel,
        actionUrl: params.actionUrl,
        deadlineAt: params.deadlineAt,
      },
      select: {
        id: true,
        tenantId: true,
        departmentId: true,
        createdByUserId: true,
        title: true,
        message: true,
        actionType: true,
        actionLabel: true,
        actionUrl: true,
        deadlineAt: true,
        disableAfterDeadline: true,
        expiredAt: true,
        createdAt: true,
        updatedAt: true,
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  async listAnnouncementsPaged(params: {
    tenantId: string;
    departmentId: string;
    skip: number;
    take: number;
  }) {
    const where = {
      tenantId: params.tenantId,
      departmentId: params.departmentId,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prismaClient.departmentAnnouncement.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip: params.skip,
        take: params.take,
        select: {
          id: true,
          tenantId: true,
          departmentId: true,
          createdByUserId: true,
          title: true,
          message: true,
          actionType: true,
          actionLabel: true,
          actionUrl: true,
          deadlineAt: true,
          disableAfterDeadline: true,
          expiredAt: true,
          createdAt: true,
          updatedAt: true,
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
        },
      }),
      this.prismaClient.departmentAnnouncement.count({ where }),
    ]);

    return { items, total };
  }

  async findAnnouncementById(params: { id: string; tenantId: string; departmentId: string }) {
    return this.prismaClient.departmentAnnouncement.findFirst({
      where: {
        id: params.id,
        tenantId: params.tenantId,
        departmentId: params.departmentId,
      },
      select: {
        id: true,
        tenantId: true,
        departmentId: true,
        createdByUserId: true,
        title: true,
        message: true,
        actionType: true,
        actionLabel: true,
        actionUrl: true,
        deadlineAt: true,
        disableAfterDeadline: true,
        expiredAt: true,
        createdAt: true,
        updatedAt: true,
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  async updateAnnouncement(params: { id: string; data: any }) {
    return this.prismaClient.departmentAnnouncement.update({
      where: { id: params.id },
      data: params.data,
      select: {
        id: true,
        tenantId: true,
        departmentId: true,
        createdByUserId: true,
        title: true,
        message: true,
        actionType: true,
        actionLabel: true,
        actionUrl: true,
        deadlineAt: true,
        disableAfterDeadline: true,
        expiredAt: true,
        createdAt: true,
        updatedAt: true,
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  async deleteAnnouncement(id: string) {
    return this.prismaClient.departmentAnnouncement.delete({
      where: { id },
      select: {
        id: true,
      },
    });
  }
}
