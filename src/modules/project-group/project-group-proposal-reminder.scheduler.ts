import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import type { NotificationEventType, NotificationSeverity } from '@prisma/client';

import {
  NOTIFICATION_EVENT_TYPES,
  NOTIFICATION_SEVERITIES,
} from '../../common/constants/notifications.constants';
import { NotificationService } from '../notification/notification.service';
import { ProjectEmailService } from '../project/project-email.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ProjectGroupRepository } from './project-group.repository';

const isWorkerDyno = (): boolean =>
  (process.env.DYNO ?? '').startsWith('worker.') || process.env.WORKER === 'true';

@Injectable()
export class ProjectGroupProposalReminderScheduler {
  private readonly logger = new Logger(ProjectGroupProposalReminderScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly projectGroupRepository: ProjectGroupRepository,
    private readonly projectEmailService: ProjectEmailService
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

  private async notifyGroupMembers(params: {
    tenantId: string;
    projectGroupId: string;
    proposalId?: string | null;
    reminderId: string;
    eventType: string;
    title: string;
    message: string;
    metadata: Record<string, unknown>;
    idempotencyPrefix: string;
  }) {
    const recipientUserIds = await this.projectGroupRepository.listProjectGroupUserIds(
      params.projectGroupId
    );

    const recipients = Array.from(new Set(recipientUserIds.filter(Boolean)));
    if (!recipients.length) return;

    await Promise.allSettled(
      recipients.map((userId) =>
        this.notificationService.createNotification({
          tenantId: params.tenantId,
          userId,
          eventType: params.eventType as NotificationEventType,
          severity: NOTIFICATION_SEVERITIES.HIGH as NotificationSeverity,
          title: params.title,
          message: params.message,
          metadata: {
            proposalId: params.proposalId ?? undefined,
            reminderId: params.reminderId,
            projectGroupId: params.projectGroupId,
            ...params.metadata,
          },
          idempotencyKey: `${params.idempotencyPrefix}:${userId}`,
        })
      )
    );
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handleProposalResubmissionReminders(): Promise<void> {
    if (isWorkerDyno()) {
      return;
    }

    const now = new Date();
    const reminders = await this.prisma.projectGroupAnnouncement.findMany({
      where: {
        kind: 'PROPOSAL_REJECTION_REMINDER',
        deadlineAt: { not: null },
      },
      select: {
        id: true,
        tenantId: true,
        departmentId: true,
        projectGroupId: true,
        proposalId: true,
        title: true,
        message: true,
        deadlineAt: true,
        disableAfterDeadline: true,
        expiredAt: true,
        reminder24hSentAt: true,
        reminder1hSentAt: true,
        deadlinePassedSentAt: true,
      },
    });

    for (const reminder of reminders) {
      if (!reminder.deadlineAt) continue;

      const msRemaining = reminder.deadlineAt.getTime() - now.getTime();
      const isPastDeadline = msRemaining <= 0;

      if (isPastDeadline) {
        const updateData: Record<string, Date> = {};

        if (reminder.disableAfterDeadline && !reminder.expiredAt) {
          updateData.expiredAt = now;
        }

        if (!reminder.deadlinePassedSentAt) {
          await this.notifyGroupMembers({
            tenantId: reminder.tenantId,
            projectGroupId: reminder.projectGroupId,
            proposalId: reminder.proposalId,
            reminderId: reminder.id,
            eventType: NOTIFICATION_EVENT_TYPES.PROPOSAL_RESUBMISSION_REMINDER_DEADLINE_PASSED,
            title: `${reminder.title} deadline passed`,
            message: 'The resubmission deadline has passed.',
            metadata: {
              deadlineAt: reminder.deadlineAt,
              reminderType: 'deadline-passed',
            },
            idempotencyPrefix: `proposal_resubmission_reminder_deadline_passed:${reminder.id}`,
          });

          try {
            if (reminder.proposalId) {
              await this.projectEmailService.sendProposalResubmissionDeadlinePassedEmails({
                proposalId: reminder.proposalId,
                reminderId: reminder.id,
                deadlineAt: reminder.deadlineAt,
                reminderTitle: reminder.title,
                reminderMessage: reminder.message,
              });
            }
          } catch {
            // ignore
          }

          updateData.deadlinePassedSentAt = now;
        }

        if (Object.keys(updateData).length > 0) {
          await this.prisma.projectGroupAnnouncement.update({
            where: { id: reminder.id },
            data: updateData,
          });
        }

        continue;
      }

      const within24h = msRemaining <= 24 * 60 * 60 * 1000;
      const within1h = msRemaining <= 60 * 60 * 1000;
      const remainingLabel = this.formatRemaining(msRemaining);

      if (!reminder.reminder24hSentAt && within24h) {
        await this.notifyGroupMembers({
          tenantId: reminder.tenantId,
          projectGroupId: reminder.projectGroupId,
          proposalId: reminder.proposalId,
          reminderId: reminder.id,
          eventType: NOTIFICATION_EVENT_TYPES.PROPOSAL_RESUBMISSION_REMINDER_24H,
          title: `${reminder.title} deadline reminder`,
          message: `Deadline is approaching. Remaining: ${remainingLabel}.`,
          metadata: {
            deadlineAt: reminder.deadlineAt,
            reminderType: '24h-or-late-catchup',
            remaining: remainingLabel,
          },
          idempotencyPrefix: `proposal_resubmission_reminder_24h:${reminder.id}`,
        });

        try {
          if (reminder.proposalId) {
            await this.projectEmailService.sendProposalResubmissionReminder24hEmails({
              proposalId: reminder.proposalId,
              reminderId: reminder.id,
              deadlineAt: reminder.deadlineAt,
              reminderTitle: reminder.title,
              reminderMessage: reminder.message,
              remaining: remainingLabel,
            });
          }
        } catch {
          // ignore
        }

        await this.prisma.projectGroupAnnouncement.update({
          where: { id: reminder.id },
          data: { reminder24hSentAt: now },
        });
      }

      if (!reminder.reminder1hSentAt && within1h) {
        await this.notifyGroupMembers({
          tenantId: reminder.tenantId,
          projectGroupId: reminder.projectGroupId,
          proposalId: reminder.proposalId,
          reminderId: reminder.id,
          eventType: NOTIFICATION_EVENT_TYPES.PROPOSAL_RESUBMISSION_REMINDER_1H,
          title: `${reminder.title} final reminder`,
          message: `Final reminder. Remaining: ${remainingLabel}.`,
          metadata: {
            deadlineAt: reminder.deadlineAt,
            reminderType: '1h',
            remaining: remainingLabel,
          },
          idempotencyPrefix: `proposal_resubmission_reminder_1h:${reminder.id}`,
        });

        try {
          if (reminder.proposalId) {
            await this.projectEmailService.sendProposalResubmissionReminder1hEmails({
              proposalId: reminder.proposalId,
              reminderId: reminder.id,
              deadlineAt: reminder.deadlineAt,
              reminderTitle: reminder.title,
              reminderMessage: reminder.message,
              remaining: remainingLabel,
            });
          }
        } catch {
          // ignore
        }

        await this.prisma.projectGroupAnnouncement.update({
          where: { id: reminder.id },
          data: { reminder1hSentAt: now },
        });
      }
    }

    this.logger.log(`Project group proposal reminder cycle processed ${reminders.length} items`);
  }
}
