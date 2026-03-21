import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationService } from '../notification/notification.service';
import { NotificationGateway } from '../notification/notification.gateway';
import { NOTIFICATION_EVENT_TYPES, NOTIFICATION_SEVERITIES } from '../../common/constants/notifications.constants';
import { DepartmentAnnouncementsRepository } from './department-announcements.repository';
import { CreateDepartmentAnnouncementDto } from './dto/create-department-announcement.dto';
import { ListDepartmentAnnouncementsQueryDto } from './dto/list-department-announcements.dto';
import { UpdateDepartmentAnnouncementDto } from './dto/update-department-announcement.dto';

@Injectable()
export class DepartmentAnnouncementsService {
  constructor(
    private readonly repository: DepartmentAnnouncementsRepository,
    private readonly notificationService: NotificationService,
    private readonly notificationGateway: NotificationGateway
  ) {}

  private async emitAnnouncementRealtime(params: {
    tenantId: string;
    departmentId: string;
    actorUserId: string;
    type: 'created' | 'updated' | 'deleted';
    announcement?: any;
    announcementId?: string;
  }) {
    try {
      const recipients = await this.repository.findDepartmentStudentUserIds(
        params.departmentId,
        params.tenantId
      );

      const userIds = recipients.filter((id) => id !== params.actorUserId);

      this.notificationGateway.emitEventToUsers(userIds, 'department-announcement', {
        type: params.type,
        announcementId: params.announcementId ?? params.announcement?.id,
        announcement: params.announcement,
      });
    } catch {
      // best effort
    }
  }

  private mapWithCountdown(item: any) {
    const nowMs = Date.now();
    const deadlineMs = item.deadlineAt ? new Date(item.deadlineAt).getTime() : null;
    const isExpiredByTime = deadlineMs !== null && deadlineMs <= nowMs;
    const isExpired = Boolean(item.expiredAt) || (item.disableAfterDeadline && isExpiredByTime);

    return {
      ...item,
      isExpired,
      isDisabled: isExpired,
      secondsRemaining:
        deadlineMs === null
          ? null
          : Math.max(0, Math.floor((deadlineMs - nowMs) / 1000)),
    };
  }

  private parseActionType(value: string): string {
    const normalized = String(value ?? '').trim().toUpperCase();
    const allowed = [
      'FORM_PROJECT_GROUP',
      'SUBMIT_PROPOSAL',
      'UPLOAD_DOCUMENT',
      'REGISTER_PRESENTATION',
      'CUSTOM_ACTION',
    ] as string[];
    if (!allowed.includes(normalized)) {
      throw new BadRequestException('Invalid actionType');
    }
    return normalized;
  }

  private parseDeadline(deadlineAt?: string): Date | undefined {
    if (!deadlineAt) return undefined;
    const parsed = new Date(deadlineAt);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Invalid deadlineAt');
    }
    return parsed;
  }

  private async assertDepartmentAccess(user: any, departmentId: string) {
    if (!user?.sub) {
      throw new ForbiddenException('Missing user context');
    }

    const tenantId: string | undefined = user?.tenantId;
    if (!tenantId) {
      throw new ForbiddenException('Missing tenant context');
    }

    const ctx = await this.repository.findUserDepartmentContext(user.sub);
    if (!ctx?.departmentId) {
      throw new ForbiddenException('User is not assigned to a department');
    }

    if (ctx.tenantId !== tenantId) {
      throw new ForbiddenException('Invalid tenant context');
    }

    if (ctx.departmentId !== departmentId) {
      throw new ForbiddenException('Access denied to department');
    }

    const ok = await this.repository.departmentExistsInTenant(departmentId, tenantId);
    if (!ok) {
      throw new ForbiddenException('Department not found for tenant');
    }

    return { tenantId, departmentId };
  }

  private async notifyAnnouncementCreated(params: {
    tenantId: string;
    departmentId: string;
    announcement: any;
    actorUserId: string;
  }) {
    const userIds = await this.repository.findDepartmentStudentUserIds(
      params.departmentId,
      params.tenantId
    );
    const recipients = userIds.filter((id) => id !== params.actorUserId);

    await Promise.allSettled(
      recipients.map((userId) => {
        const idempotencyKey = `department_announcement_created:${params.announcement.id}:${userId}`;
        return this.notificationService.createNotification({
          tenantId: params.tenantId,
          userId,
          eventType: NOTIFICATION_EVENT_TYPES.DEPARTMENT_ANNOUNCEMENT_CREATED as any,
          severity: NOTIFICATION_SEVERITIES.INFO as any,
          title: params.announcement.title,
          message: params.announcement.message,
          metadata: {
            departmentId: params.departmentId,
            announcementId: params.announcement.id,
            actionType: params.announcement.actionType,
            actionLabel: params.announcement.actionLabel,
            actionUrl: params.announcement.actionUrl,
            deadlineAt: params.announcement.deadlineAt,
          },
          idempotencyKey,
        });
      })
    );
  }

  async createAnnouncement(
    departmentId: string,
    dto: CreateDepartmentAnnouncementDto,
    user: any
  ) {
    const { tenantId } = await this.assertDepartmentAccess(user, departmentId);

    const deadlineAt = this.parseDeadline(dto.deadlineAt);
    if (deadlineAt && deadlineAt.getTime() <= Date.now()) {
      throw new BadRequestException('deadlineAt must be in the future');
    }

    const created = await this.repository.createAnnouncement({
      tenantId,
      departmentId,
      createdByUserId: user.sub,
      title: dto.title,
      message: dto.message,
      actionType: this.parseActionType(dto.actionType),
      actionLabel: dto.actionLabel,
      actionUrl: dto.actionUrl,
      deadlineAt,
    });

    await this.notifyAnnouncementCreated({
      tenantId,
      departmentId,
      announcement: created,
      actorUserId: user.sub,
    });

    void this.emitAnnouncementRealtime({
      tenantId,
      departmentId,
      actorUserId: user.sub,
      type: 'created',
      announcement: this.mapWithCountdown(created),
    });

    return this.mapWithCountdown(created);
  }

  async listAnnouncements(
    departmentId: string,
    query: ListDepartmentAnnouncementsQueryDto,
    user: any
  ) {
    const { tenantId } = await this.assertDepartmentAccess(user, departmentId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const { items, total } = await this.repository.listAnnouncementsPaged({
      tenantId,
      departmentId,
      skip,
      take: limit,
    });

    return {
      items: items.map((item: any) => this.mapWithCountdown(item)),
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getAnnouncement(departmentId: string, announcementId: string, user: any) {
    const { tenantId } = await this.assertDepartmentAccess(user, departmentId);

    const found = await this.repository.findAnnouncementById({
      id: announcementId,
      tenantId,
      departmentId,
    });

    if (!found) {
      throw new NotFoundException('Announcement not found');
    }

    return this.mapWithCountdown(found);
  }

  async updateAnnouncement(
    departmentId: string,
    announcementId: string,
    dto: UpdateDepartmentAnnouncementDto,
    user: any
  ) {
    const { tenantId } = await this.assertDepartmentAccess(user, departmentId);

    const existing = await this.repository.findAnnouncementById({
      id: announcementId,
      tenantId,
      departmentId,
    });
    if (!existing) {
      throw new NotFoundException('Announcement not found');
    }

    const data: any = {
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.message !== undefined ? { message: dto.message } : {}),
      ...(dto.actionType !== undefined ? { actionType: this.parseActionType(dto.actionType) } : {}),
      ...(dto.actionLabel !== undefined ? { actionLabel: dto.actionLabel } : {}),
      ...(dto.actionUrl !== undefined ? { actionUrl: dto.actionUrl } : {}),
    };

    if (dto.clearDeadline === true) {
      Object.assign(data, {
        deadlineAt: null,
        expiredAt: null,
        reminder24hSentAt: null,
        reminder1hSentAt: null,
      });
    } else if (dto.deadlineAt !== undefined) {
      const deadlineAt = this.parseDeadline(dto.deadlineAt);
      if (deadlineAt && deadlineAt.getTime() <= Date.now()) {
        throw new BadRequestException('deadlineAt must be in the future');
      }
      Object.assign(data, {
        deadlineAt,
        expiredAt: null,
        reminder24hSentAt: null,
        reminder1hSentAt: null,
      });
    }

    const updated = await this.repository.updateAnnouncement({
      id: announcementId,
      data,
    });

    void this.emitAnnouncementRealtime({
      tenantId,
      departmentId,
      actorUserId: user.sub,
      type: 'updated',
      announcement: this.mapWithCountdown(updated),
    });

    return this.mapWithCountdown(updated);
  }

  async deleteAnnouncement(departmentId: string, announcementId: string, user: any) {
    const { tenantId } = await this.assertDepartmentAccess(user, departmentId);

    const existing = await this.repository.findAnnouncementById({
      id: announcementId,
      tenantId,
      departmentId,
    });
    if (!existing) {
      throw new NotFoundException('Announcement not found');
    }

    const deleted = await this.repository.deleteAnnouncement(announcementId);

    void this.emitAnnouncementRealtime({
      tenantId,
      departmentId,
      actorUserId: user.sub,
      type: 'deleted',
      announcementId: deleted.id,
    });

    return {
      id: deleted.id,
      deleted: true,
    };
  }
}
