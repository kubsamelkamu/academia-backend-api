import { Injectable } from '@nestjs/common';
import { ProjectGroupTaskStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ProjectGroupTaskRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(params: {
    tenantId: string;
    projectGroupId: string;
    createdByUserId: string;
    assignedToUserId?: string | null;
    title: string;
    description?: string | null;
    dueDate?: Date | null;
  }) {
    return this.prisma.projectGroupTask.create({
      data: {
        tenantId: params.tenantId,
        projectGroupId: params.projectGroupId,
        createdByUserId: params.createdByUserId,
        assignedToUserId: params.assignedToUserId ?? null,
        title: params.title,
        description: params.description ?? null,
        dueDate: params.dueDate ?? null,
      },
      select: {
        id: true,
        tenantId: true,
        projectGroupId: true,
        createdByUserId: true,
        assignedToUserId: true,
        title: true,
        description: true,
        dueDate: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async listForGroup(params: { tenantId: string; projectGroupId: string }) {
    return this.prisma.projectGroupTask.findMany({
      where: {
        tenantId: params.tenantId,
        projectGroupId: params.projectGroupId,
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        tenantId: true,
        projectGroupId: true,
        createdByUserId: true,
        assignedToUserId: true,
        title: true,
        description: true,
        dueDate: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findByIdForGroup(params: { tenantId: string; projectGroupId: string; taskId: string }) {
    return this.prisma.projectGroupTask.findFirst({
      where: {
        id: params.taskId,
        tenantId: params.tenantId,
        projectGroupId: params.projectGroupId,
      },
      select: {
        id: true,
        tenantId: true,
        projectGroupId: true,
        createdByUserId: true,
        assignedToUserId: true,
        title: true,
        description: true,
        dueDate: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updateDetails(params: {
    tenantId: string;
    projectGroupId: string;
    taskId: string;
    title?: string;
    description?: string | null;
    dueDate?: Date | null;
  }) {
    return this.prisma.projectGroupTask.update({
      where: { id: params.taskId },
      data: {
        ...(params.title !== undefined ? { title: params.title } : {}),
        ...(params.description !== undefined ? { description: params.description } : {}),
        ...(params.dueDate !== undefined ? { dueDate: params.dueDate } : {}),
      },
      select: {
        id: true,
        tenantId: true,
        projectGroupId: true,
        createdByUserId: true,
        assignedToUserId: true,
        title: true,
        description: true,
        dueDate: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updateAssignee(params: {
    tenantId: string;
    projectGroupId: string;
    taskId: string;
    assignedToUserId: string | null;
  }) {
    return this.prisma.projectGroupTask.update({
      where: { id: params.taskId },
      data: {
        assignedToUserId: params.assignedToUserId,
      },
      select: {
        id: true,
        tenantId: true,
        projectGroupId: true,
        createdByUserId: true,
        assignedToUserId: true,
        title: true,
        description: true,
        dueDate: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updateStatus(params: {
    tenantId: string;
    projectGroupId: string;
    taskId: string;
    status: ProjectGroupTaskStatus;
  }) {
    return this.prisma.projectGroupTask.update({
      where: { id: params.taskId },
      data: {
        status: params.status,
      },
      select: {
        id: true,
        tenantId: true,
        projectGroupId: true,
        createdByUserId: true,
        assignedToUserId: true,
        title: true,
        description: true,
        dueDate: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async delete(params: { tenantId: string; projectGroupId: string; taskId: string }) {
    return this.prisma.projectGroupTask.delete({
      where: { id: params.taskId },
      select: { id: true },
    });
  }
}
