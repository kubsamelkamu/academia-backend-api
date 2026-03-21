import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationService } from '../notification/notification.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  NOTIFICATION_EVENT_TYPES,
  NOTIFICATION_SEVERITIES,
} from '../../common/constants/notifications.constants';
import { DepartmentAnnouncementsRepository } from './department-announcements.repository';

@Injectable()
export class DepartmentAnnouncementScheduler {
  private readonly logger = new Logger(DepartmentAnnouncementScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly announcementRepository: DepartmentAnnouncementsRepository
  ) {}

  private get prismaClient(): any {
    return this.prisma as any;
  }

  private formatRemaining(msRemaining: number): string {
    const totalMinutes = Math.max(0, Math.floor(msRemaining / 60000));
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    }

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }

    return `${minutes}m`;
  }

  private async notifyStudents(params: {
    tenantId: string;
    departmentId: string;
    actorUserId: string;
    eventType: string;
    title: string;
    message: string;
    metadata: Record<string, any>;
    idempotencyPrefix: string;
  }) {
    const studentIds = await this.announcementRepository.findDepartmentStudentUserIds(
      params.departmentId,
      params.tenantId
    );

    const recipients = studentIds.filter((id) => id !== params.actorUserId);

    await Promise.allSettled(
      recipients.map((userId) => {
        const idempotencyKey = `${params.idempotencyPrefix}:${userId}`;

        return this.notificationService.createNotification({
          tenantId: params.tenantId,
          userId,
          eventType: params.eventType as any,
          severity: NOTIFICATION_SEVERITIES.INFO as any,
          title: params.title,
          message: params.message,
          metadata: params.metadata,
          idempotencyKey,
        });
      })
    );
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleDepartmentAnnouncementReminders() {
    if ((process.env.DYNO ?? '').startsWith('worker.') || process.env.WORKER === 'true') {
      return;
    }

    const now = new Date();
    const items = await this.prismaClient.departmentAnnouncement.findMany({
      where: {
        deadlineAt: { not: null },
      },
      select: {
        id: true,
        tenantId: true,
        departmentId: true,
        createdByUserId: true,
        title: true,
        actionType: true,
        actionLabel: true,
        actionUrl: true,
        deadlineAt: true,
        disableAfterDeadline: true,
        expiredAt: true,
        reminder24hSentAt: true,
        reminder1hSentAt: true,
      },
    });

    for (const item of items) {
      if (!item.deadlineAt) continue;

      const msRemaining = item.deadlineAt.getTime() - now.getTime();
      const isPastDeadline = msRemaining <= 0;

      if (isPastDeadline) {
        if (item.disableAfterDeadline && !item.expiredAt) {
          await this.prismaClient.departmentAnnouncement.update({
            where: { id: item.id },
            data: { expiredAt: now },
          });
        }

        await this.notifyStudents({
          tenantId: item.tenantId,
          departmentId: item.departmentId,
          actorUserId: item.createdByUserId,
          eventType: NOTIFICATION_EVENT_TYPES.DEPARTMENT_ANNOUNCEMENT_DEADLINE_PASSED,
          title: `${item.title} deadline passed`,
          message: 'The announcement deadline has passed.',
          metadata: {
            announcementId: item.id,
            actionType: item.actionType,
            actionLabel: item.actionLabel,
            actionUrl: item.actionUrl,
            deadlineAt: item.deadlineAt,
          },
          idempotencyPrefix: `department_announcement_deadline_passed:${item.id}`,
        });

        continue;
      }

      const within24h = msRemaining <= 24 * 60 * 60 * 1000;
      const within1h = msRemaining <= 60 * 60 * 1000;
      const remainingLabel = this.formatRemaining(msRemaining);

      if (!item.reminder24hSentAt && within24h) {
        await this.notifyStudents({
          tenantId: item.tenantId,
          departmentId: item.departmentId,
          actorUserId: item.createdByUserId,
          eventType: NOTIFICATION_EVENT_TYPES.DEPARTMENT_ANNOUNCEMENT_DEADLINE_24H,
          title: `${item.title} deadline reminder`,
          message: `Deadline is approaching. Remaining: ${remainingLabel}.`,
          metadata: {
            announcementId: item.id,
            actionType: item.actionType,
            actionLabel: item.actionLabel,
            actionUrl: item.actionUrl,
            deadlineAt: item.deadlineAt,
            reminderType: '24h-or-late-catchup',
          },
          idempotencyPrefix: `department_announcement_deadline_24h:${item.id}`,
        });

        await this.prismaClient.departmentAnnouncement.update({
          where: { id: item.id },
          data: {
            reminder24hSentAt: now,
          },
        });
      }

      if (!item.reminder1hSentAt && within1h) {
        await this.notifyStudents({
          tenantId: item.tenantId,
          departmentId: item.departmentId,
          actorUserId: item.createdByUserId,
          eventType: NOTIFICATION_EVENT_TYPES.DEPARTMENT_ANNOUNCEMENT_DEADLINE_1H,
          title: `${item.title} final reminder`,
          message: `Final reminder. Remaining: ${remainingLabel}.`,
          metadata: {
            announcementId: item.id,
            actionType: item.actionType,
            actionLabel: item.actionLabel,
            actionUrl: item.actionUrl,
            deadlineAt: item.deadlineAt,
            reminderType: '1h',
          },
          idempotencyPrefix: `department_announcement_deadline_1h:${item.id}`,
        });

        await this.prismaClient.departmentAnnouncement.update({
          where: { id: item.id },
          data: {
            reminder1hSentAt: now,
          },
        });
      }
    }

    this.logger.log(`Department announcement reminder cycle processed ${items.length} items`);
  }
}
