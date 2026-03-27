import { BadRequestException, Injectable } from '@nestjs/common';
import { ProjectGroupStatus } from '@prisma/client';

import { ROLES } from '../../common/constants/roles.constants';
import {
  InsufficientPermissionsException,
  UnauthorizedAccessException,
} from '../../common/exceptions';

import { AuthRepository } from '../auth/auth.repository';

import { ProjectGroupRepository } from './project-group.repository';
import { ProjectGroupTaskRepository } from './project-group-task.repository';
import { CreateProjectGroupTaskDto } from './dto/create-project-group-task.dto';
import { UpdateProjectGroupTaskDto } from './dto/update-project-group-task.dto';
import { UpdateProjectGroupTaskStatusDto } from './dto/update-project-group-task-status.dto';
import { UpdateProjectGroupTaskAssigneeDto } from './dto/update-project-group-task-assignee.dto';

@Injectable()
export class ProjectGroupTaskService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly projectGroupRepository: ProjectGroupRepository,
    private readonly projectGroupTaskRepository: ProjectGroupTaskRepository
  ) {}

  private async requireDbUser(user: any) {
    if (!user?.sub) {
      throw new UnauthorizedAccessException();
    }

    const dbUser = await this.authRepository.findUserById(user.sub);
    if (!dbUser) {
      throw new UnauthorizedAccessException();
    }

    if (user.tenantId && user.tenantId !== 'system' && dbUser.tenantId !== user.tenantId) {
      throw new UnauthorizedAccessException();
    }

    return dbUser;
  }

  private async requireApprovedMyGroupForStudent(user: any) {
    const dbUser = await this.requireDbUser(user);

    const roles: string[] = user?.roles ?? [];
    if (!roles.includes(ROLES.STUDENT)) {
      throw new InsufficientPermissionsException('Only students can perform this action');
    }

    if (!dbUser.departmentId) {
      throw new BadRequestException('Student is not assigned to a department');
    }

    const group = await this.projectGroupRepository.findMyGroupBasicForStudent({
      tenantId: dbUser.tenantId,
      departmentId: dbUser.departmentId,
      userId: dbUser.id,
    });

    if (!group) {
      throw new BadRequestException('Group not found for this student');
    }

    if (group.status !== ProjectGroupStatus.APPROVED) {
      throw new BadRequestException('Group is not approved yet');
    }

    return { dbUser: { ...dbUser, departmentId: dbUser.departmentId }, group };
  }

  private isLeader(params: { groupLeaderUserId: string; userId: string }) {
    return params.groupLeaderUserId === params.userId;
  }

  private async requireTaskInMyGroup(params: {
    tenantId: string;
    projectGroupId: string;
    taskId: string;
  }) {
    const task = await this.projectGroupTaskRepository.findByIdForGroup({
      tenantId: params.tenantId,
      projectGroupId: params.projectGroupId,
      taskId: params.taskId,
    });

    if (!task) {
      throw new BadRequestException('Task not found for this group');
    }

    return task;
  }

  async createTaskForMyGroup(user: any, dto: CreateProjectGroupTaskDto) {
    const { dbUser, group } = await this.requireApprovedMyGroupForStudent(user);

    const isLeader = this.isLeader({ groupLeaderUserId: group.leaderUserId, userId: dbUser.id });

    let assignedToUserId: string | null = null;
    if (dto.assignedToUserId) {
      // Leader can assign any group member; members can only self-assign.
      if (!isLeader && dto.assignedToUserId !== dbUser.id) {
        throw new InsufficientPermissionsException(
          'Only the group leader can assign tasks to others'
        );
      }

      const groupUserIds = await this.projectGroupRepository.listProjectGroupUserIds(group.id);
      if (!groupUserIds.includes(dto.assignedToUserId)) {
        throw new BadRequestException('Assignee must be a member of this group');
      }

      assignedToUserId = dto.assignedToUserId;
    }

    const created = await this.projectGroupTaskRepository.create({
      tenantId: dbUser.tenantId,
      projectGroupId: group.id,
      createdByUserId: dbUser.id,
      assignedToUserId,
      title: dto.title,
      description: dto.description ?? null,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
    });

    return { task: created };
  }

  async listTasksForMyGroup(user: any) {
    const { dbUser, group } = await this.requireApprovedMyGroupForStudent(user);

    const items = await this.projectGroupTaskRepository.listForGroup({
      tenantId: dbUser.tenantId,
      projectGroupId: group.id,
    });

    return { items };
  }

  async getTaskForMyGroup(user: any, taskId: string) {
    const { dbUser, group } = await this.requireApprovedMyGroupForStudent(user);

    const task = await this.requireTaskInMyGroup({
      tenantId: dbUser.tenantId,
      projectGroupId: group.id,
      taskId,
    });

    return { task };
  }

  async updateTaskDetailsForMyGroup(user: any, taskId: string, dto: UpdateProjectGroupTaskDto) {
    const { dbUser, group } = await this.requireApprovedMyGroupForStudent(user);

    const task = await this.requireTaskInMyGroup({
      tenantId: dbUser.tenantId,
      projectGroupId: group.id,
      taskId,
    });

    const isLeader = this.isLeader({ groupLeaderUserId: group.leaderUserId, userId: dbUser.id });
    const canEdit = isLeader || task.createdByUserId === dbUser.id;

    if (!canEdit) {
      throw new InsufficientPermissionsException(
        'Only the task creator or group leader can edit this task'
      );
    }

    const updated = await this.projectGroupTaskRepository.updateDetails({
      tenantId: dbUser.tenantId,
      projectGroupId: group.id,
      taskId,
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.description !== undefined ? { description: dto.description ?? null } : {}),
      ...(dto.dueDate !== undefined ? { dueDate: dto.dueDate ? new Date(dto.dueDate) : null } : {}),
    });

    return { task: updated };
  }

  async updateTaskStatusForMyGroup(
    user: any,
    taskId: string,
    dto: UpdateProjectGroupTaskStatusDto
  ) {
    const { dbUser, group } = await this.requireApprovedMyGroupForStudent(user);

    const task = await this.requireTaskInMyGroup({
      tenantId: dbUser.tenantId,
      projectGroupId: group.id,
      taskId,
    });

    const isLeader = this.isLeader({ groupLeaderUserId: group.leaderUserId, userId: dbUser.id });
    const isAssignee = !!task.assignedToUserId && task.assignedToUserId === dbUser.id;

    if (!isLeader && !isAssignee) {
      throw new InsufficientPermissionsException(
        'Only the task assignee or group leader can change status'
      );
    }

    const updated = await this.projectGroupTaskRepository.updateStatus({
      tenantId: dbUser.tenantId,
      projectGroupId: group.id,
      taskId,
      status: dto.status,
    });

    return { task: updated };
  }

  async updateTaskAssigneeForMyGroupLeader(
    user: any,
    taskId: string,
    dto: UpdateProjectGroupTaskAssigneeDto
  ) {
    const { dbUser, group } = await this.requireApprovedMyGroupForStudent(user);

    const isLeader = this.isLeader({ groupLeaderUserId: group.leaderUserId, userId: dbUser.id });
    if (!isLeader) {
      throw new InsufficientPermissionsException('Only the group leader can reassign tasks');
    }

    await this.requireTaskInMyGroup({
      tenantId: dbUser.tenantId,
      projectGroupId: group.id,
      taskId,
    });

    let assignedToUserId: string | null = null;
    if (dto.assignedToUserId) {
      const groupUserIds = await this.projectGroupRepository.listProjectGroupUserIds(group.id);
      if (!groupUserIds.includes(dto.assignedToUserId)) {
        throw new BadRequestException('Assignee must be a member of this group');
      }
      assignedToUserId = dto.assignedToUserId;
    }

    const updated = await this.projectGroupTaskRepository.updateAssignee({
      tenantId: dbUser.tenantId,
      projectGroupId: group.id,
      taskId,
      assignedToUserId,
    });

    return { task: updated };
  }

  async deleteTaskForMyGroup(user: any, taskId: string) {
    const { dbUser, group } = await this.requireApprovedMyGroupForStudent(user);

    const task = await this.requireTaskInMyGroup({
      tenantId: dbUser.tenantId,
      projectGroupId: group.id,
      taskId,
    });

    const isLeader = this.isLeader({ groupLeaderUserId: group.leaderUserId, userId: dbUser.id });
    const canDelete = isLeader || task.createdByUserId === dbUser.id;

    if (!canDelete) {
      throw new InsufficientPermissionsException(
        'Only the task creator or group leader can delete this task'
      );
    }

    await this.projectGroupTaskRepository.delete({
      tenantId: dbUser.tenantId,
      projectGroupId: group.id,
      taskId,
    });

    return { deleted: true };
  }
}
