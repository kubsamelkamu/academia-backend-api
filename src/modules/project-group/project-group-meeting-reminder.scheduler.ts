import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationEventType, NotificationSeverity } from '@prisma/client';

import {
  NOTIFICATION_EVENT_TYPES,
  NOTIFICATION_SEVERITIES,
} from '../../common/constants/notifications.constants';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../core/email/email.service';
import { NotificationService } from '../notification/notification.service';
import { ProjectGroupRepository } from './project-group.repository';

const isWorkerDyno = (): boolean =>
  (process.env.DYNO ?? '').startsWith('worker.') || process.env.WORKER === 'true';

@Injectable()
export class ProjectGroupMeetingReminderScheduler {
  private readonly logger = new Logger(ProjectGroupMeetingReminderScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
    private readonly notificationService: NotificationService,
    private readonly projectGroupRepository: ProjectGroupRepository
  ) {}

  private formatRemaining(msRemaining: number): string {
    const totalMinutes = Math.max(0, Math.floor(msRemaining / 60000));
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  private async notifyMeetingReminder(params: {
    tenantId: string;
    projectId: string;
    projectGroupId: string;
    meetingId: string;
    title: string;
    meetingAt: Date;
    durationMinutes: number;
    agenda: string;
    eventType: NotificationEventType;
    idempotencyPrefix: string;
    titlePrefix: string;
    messagePrefix: string;
  }) {
    const recipientUserIds = await this.projectGroupRepository.listProjectGroupUserIds(
      params.projectGroupId
    );

    const recipients = Array.from(new Set(recipientUserIds.filter(Boolean)));
    if (!recipients.length) return;

    const remainingLabel = this.formatRemaining(params.meetingAt.getTime() - Date.now());

    await Promise.allSettled(
      recipients.map((userId) =>
        this.notificationService.createNotification({
          tenantId: params.tenantId,
          userId,
          eventType: params.eventType,
          severity: NOTIFICATION_SEVERITIES.INFO as NotificationSeverity,
          title: `${params.titlePrefix}: ${params.title}`,
          message: `${params.messagePrefix}. Starts in ${remainingLabel}.`,
          metadata: {
            projectId: params.projectId,
            projectGroupId: params.projectGroupId,
            meetingId: params.meetingId,
            meetingTitle: params.title,
            meetingAt: params.meetingAt,
            durationMinutes: params.durationMinutes,
            agenda: params.agenda,
            reminderType: params.eventType,
            remaining: remainingLabel,
          },
          idempotencyKey: `${params.idempotencyPrefix}:${params.meetingAt.getTime()}:${userId}`,
        })
      )
    );

    await this.sendMeetingReminderEmails({
      recipientUserIds: recipients,
      eventType: params.eventType,
      title: params.title,
      meetingAt: params.meetingAt,
      durationMinutes: params.durationMinutes,
      agenda: params.agenda,
      projectId: params.projectId,
      projectGroupId: params.projectGroupId,
      meetingId: params.meetingId,
      remainingLabel,
    });
  }

  private async sendMeetingReminderEmails(params: {
    recipientUserIds: string[];
    eventType: NotificationEventType;
    title: string;
    meetingAt: Date;
    durationMinutes: number;
    agenda: string;
    projectId: string;
    projectGroupId: string;
    meetingId: string;
    remainingLabel: string;
  }): Promise<void> {
    const templateId =
      params.eventType ===
      (NOTIFICATION_EVENT_TYPES.PROJECT_GROUP_MEETING_REMINDER_1H as NotificationEventType)
        ? this.config.get<number>('email.projectGroupMeetingReminder1hTemplateId')
        : this.config.get<number>('email.projectGroupMeetingReminder24hTemplateId');

    // Email reminders are optional and only sent when template IDs are configured.
    if (!templateId) {
      return;
    }

    const users = await this.prisma.user.findMany({
      where: { id: { in: params.recipientUserIds } },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    });

    const emailJobs = users
      .map((user) => {
        const email = String(user.email ?? '').trim();
        if (!email) return null;

        return this.emailService.sendTransactionalTemplateEmail({
          to: {
            email,
            name: `${String(user.firstName ?? '').trim()} ${String(user.lastName ?? '').trim()}`.trim(),
          },
          templateId,
          params: {
            ...this.emailService.getCommonTemplateParams(),
            meetingId: params.meetingId,
            meetingTitle: params.title,
            meetingAt: params.meetingAt,
            durationMinutes: params.durationMinutes,
            agenda: params.agenda,
            projectId: params.projectId,
            projectGroupId: params.projectGroupId,
            remaining: params.remainingLabel,
            reminderType:
              params.eventType ===
              (NOTIFICATION_EVENT_TYPES.PROJECT_GROUP_MEETING_REMINDER_1H as NotificationEventType)
                ? '1h'
                : '24h',
          },
        });
      })
      .filter(Boolean) as Array<Promise<void>>;

    await Promise.allSettled(emailJobs);
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleMeetingReminders(): Promise<void> {
    if (isWorkerDyno()) {
      return;
    }

    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const meetings = await this.prisma.projectGroupMeeting.findMany({
      where: {
        cancelledAt: null,
        meetingAt: {
          gt: now,
          lte: in24h,
        },
        OR: [{ reminder24hSentAt: null }, { reminder1hSentAt: null }],
      },
      select: {
        id: true,
        tenantId: true,
        projectId: true,
        projectGroupId: true,
        title: true,
        meetingAt: true,
        durationMinutes: true,
        agenda: true,
        reminder24hSentAt: true,
        reminder1hSentAt: true,
      },
    });

    for (const meeting of meetings) {
      const msRemaining = meeting.meetingAt.getTime() - now.getTime();
      if (msRemaining <= 0) continue;

      const within24h = msRemaining <= 24 * 60 * 60 * 1000;
      const within1h = msRemaining <= 60 * 60 * 1000;

      const updates: { reminder24hSentAt?: Date; reminder1hSentAt?: Date } = {};

      if (!meeting.reminder24hSentAt && within24h) {
        await this.notifyMeetingReminder({
          tenantId: meeting.tenantId,
          projectId: meeting.projectId,
          projectGroupId: meeting.projectGroupId,
          meetingId: meeting.id,
          title: meeting.title,
          meetingAt: meeting.meetingAt,
          durationMinutes: meeting.durationMinutes,
          agenda: meeting.agenda,
          eventType:
            NOTIFICATION_EVENT_TYPES.PROJECT_GROUP_MEETING_REMINDER_24H as NotificationEventType,
          idempotencyPrefix: `project_group_meeting_reminder_24h:${meeting.id}`,
          titlePrefix: 'Meeting Reminder',
          messagePrefix: 'Your project-group meeting is approaching',
        });
        updates.reminder24hSentAt = now;
      }

      if (!meeting.reminder1hSentAt && within1h) {
        await this.notifyMeetingReminder({
          tenantId: meeting.tenantId,
          projectId: meeting.projectId,
          projectGroupId: meeting.projectGroupId,
          meetingId: meeting.id,
          title: meeting.title,
          meetingAt: meeting.meetingAt,
          durationMinutes: meeting.durationMinutes,
          agenda: meeting.agenda,
          eventType:
            NOTIFICATION_EVENT_TYPES.PROJECT_GROUP_MEETING_REMINDER_1H as NotificationEventType,
          idempotencyPrefix: `project_group_meeting_reminder_1h:${meeting.id}`,
          titlePrefix: 'Final Meeting Reminder',
          messagePrefix: 'Final reminder for your project-group meeting',
        });
        updates.reminder1hSentAt = now;
      }

      if (updates.reminder24hSentAt || updates.reminder1hSentAt) {
        await this.prisma.projectGroupMeeting.update({
          where: { id: meeting.id },
          data: updates,
        });
      }
    }

    this.logger.log(`Project group meeting reminder cycle processed ${meetings.length} meetings`);
  }
}
