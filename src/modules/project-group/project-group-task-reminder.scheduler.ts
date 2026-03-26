import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  NotificationEventType,
  NotificationSeverity,
  ProjectGroupStatus,
  ProjectGroupTaskStatus,
} from '@prisma/client';

import { NOTIFICATION_EVENT_TYPES } from '../../common/constants/notifications.constants';
import { NotificationService } from '../notification/notification.service';
import { PrismaService } from '../../prisma/prisma.service';

const isWorkerDyno = (): boolean =>
  (process.env.DYNO ?? '').startsWith('worker.') || process.env.WORKER === 'true';

@Injectable()
export class ProjectGroupTaskReminderScheduler {
  private readonly logger = new Logger(ProjectGroupTaskReminderScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService
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

  /**
   * Runs every 5 minutes to avoid missing short-notice due dates.
   * Creates *idempotent* notifications for assigned tasks due within the next 24 hours.
   */
  @Cron('*/5 * * * *')
  async handleProjectGroupTaskDueDateReminders(): Promise<void> {
    // IMPORTANT: worker dynos should only process queues, not run schedulers.
    if (isWorkerDyno()) {
      return;
    }

    const now = new Date();
    const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const pageSize = 200;

    let lastId: string | undefined;
    let processed = 0;

    while (true) {
      const tasks = await this.prisma.projectGroupTask.findMany({
        where: {
          dueDate: {
            not: null,
            gt: now,
            lte: windowEnd,
          },
          assignedToUserId: { not: null },
          status: { not: ProjectGroupTaskStatus.DONE },
          projectGroup: {
            status: ProjectGroupStatus.APPROVED,
          },
          ...(lastId ? { id: { gt: lastId } } : {}),
        },
        orderBy: { id: 'asc' },
        take: pageSize,
        select: {
          id: true,
          tenantId: true,
          projectGroupId: true,
          title: true,
          dueDate: true,
          assignedToUserId: true,
          projectGroup: {
            select: {
              leaderUserId: true,
            },
          },
        },
      });

      if (tasks.length === 0) break;
      lastId = tasks[tasks.length - 1].id;

      for (const task of tasks) {
        if (!task.dueDate || !task.assignedToUserId) continue;

        const msRemaining = task.dueDate.getTime() - now.getTime();
        if (msRemaining <= 0) continue;

        const remainingLabel = this.formatRemaining(msRemaining);
        const assigneeId = task.assignedToUserId;
        const leaderId = task.projectGroup?.leaderUserId;

        try {
          await this.notificationService.createNotification({
            tenantId: task.tenantId,
            userId: assigneeId,
            eventType:
              NOTIFICATION_EVENT_TYPES.PROJECT_GROUP_TASK_DUE_DATE_24H as NotificationEventType,
            severity: NotificationSeverity.INFO,
            title: `Task due soon: ${task.title}`,
            message: `Reminder: "${task.title}" is due in ${remainingLabel}.`,
            metadata: {
              taskId: task.id,
              projectGroupId: task.projectGroupId,
              assignedToUserId: assigneeId,
              dueDate: task.dueDate,
              reminderType: '24h',
              remaining: remainingLabel,
              recipientRole: 'assignee',
            },
            idempotencyKey: `project_group_task_due_24h:${task.id}:${assigneeId}:${task.dueDate.getTime()}`,
          });

          processed += 1;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.warn(`Task due reminder failed for taskId=${task.id} (${message})`);
        }

        if (leaderId && leaderId !== assigneeId) {
          try {
            await this.notificationService.createNotification({
              tenantId: task.tenantId,
              userId: leaderId,
              eventType:
                NOTIFICATION_EVENT_TYPES.PROJECT_GROUP_TASK_DUE_DATE_24H as NotificationEventType,
              severity: NotificationSeverity.INFO,
              title: `Group task due soon: ${task.title}`,
              message: `Reminder: a group task "${task.title}" is due in ${remainingLabel}.`,
              metadata: {
                taskId: task.id,
                projectGroupId: task.projectGroupId,
                assignedToUserId: assigneeId,
                dueDate: task.dueDate,
                reminderType: '24h',
                remaining: remainingLabel,
                recipientRole: 'leader',
              },
              idempotencyKey: `project_group_task_due_24h:${task.id}:${leaderId}:${task.dueDate.getTime()}`,
            });

            processed += 1;
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.logger.warn(
              `Task due reminder failed for leader userId=${leaderId} taskId=${task.id} (${message})`
            );
          }
        }
      }

      if (tasks.length < pageSize) break;
    }

    this.logger.log(`Project group task due reminders processed: ${processed}`);
  }
}
