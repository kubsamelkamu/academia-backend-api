import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../../prisma/prisma.service';
import { QueueService } from '../../core/queue/queue.service';
import { EmailService } from '../../core/email/email.service';
import { ROLES } from '../../common/constants/roles.constants';

const isWorkerDyno = (): boolean =>
  (process.env.DYNO ?? '').startsWith('worker.') || process.env.WORKER === 'true';

const normalizeUrl = (url: string): string => url.replace(/\/+$/, '');

const hasText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const hasAnyText = (...values: Array<unknown>): boolean => values.some((v) => hasText(v));

const techStackHasAtLeastOne = (value: unknown): boolean => {
  if (!Array.isArray(value)) return false;
  return value.some((v) => hasText(v));
};

const isStudentProfileComplete = (student: {
  bio?: unknown;
  githubUrl?: unknown;
  linkedinUrl?: unknown;
  portfolioUrl?: unknown;
  techStack?: unknown;
} | null): boolean => {
  if (!student) return false;

  const bioOk = hasText(student.bio);
  const socialOk = hasAnyText(student.githubUrl, student.linkedinUrl, student.portfolioUrl);
  const techStackOk = techStackHasAtLeastOne(student.techStack);

  return bioOk && techStackOk && socialOk;
};

@Injectable()
export class StudentProfileCompletionReminderScheduler {
  private readonly logger = new Logger(StudentProfileCompletionReminderScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly queue: QueueService,
    private readonly emailService: EmailService
  ) {}

  /**
   * Daily scheduler: sends a one-time reminder email to students who have not completed their student profile.
   *
   * Completion rule (Step 2 = A):
   * - bio
   * - techStack (at least 1)
   * - at least 1 social link (GitHub OR LinkedIn OR Portfolio)
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleStudentProfileCompletionReminders(): Promise<void> {
    // IMPORTANT: worker dynos should only process queues, not run schedulers.
    if (isWorkerDyno()) {
      return;
    }

    const templateId = this.config.get<number>('email.studentProfileCompletionReminderTemplateId');
    if (!templateId) {
      this.logger.warn(
        'Student profile completion reminder template ID not configured; skipping reminder email scheduler'
      );
      return;
    }

    const frontendUrl = this.config.get<string>('app.frontendUrl') || process.env.FRONTEND_URL;
    const profileUrl = `${normalizeUrl(frontendUrl || 'http://localhost:3000')}/dashboard/profile`;

    const now = new Date();
    const pageSize = 200;

    this.logger.log('Running student profile completion reminder scheduler...');

    let lastId: string | undefined;

    while (true) {
      const users = await this.prisma.user.findMany({
        where: {
          deletedAt: null,
          status: 'ACTIVE',
          studentProfileReminderSentAt: null,
          roles: {
            some: {
              role: {
                name: ROLES.STUDENT,
              },
            },
          },
          ...(lastId ? { id: { gt: lastId } } : {}),
        },
        orderBy: { id: 'asc' },
        take: pageSize,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          tenantId: true,
          student: {
            select: {
              bio: true,
              githubUrl: true,
              linkedinUrl: true,
              portfolioUrl: true,
              techStack: true,
            },
          },
        },
      });

      if (users.length === 0) break;
      lastId = users[users.length - 1].id;

      for (const user of users) {
        if (!hasText(user.email)) continue;

        const complete = isStudentProfileComplete(user.student as any);
        if (complete) continue;

        // Atomic guard: only one process should mark + enqueue.
        const locked = await this.prisma.user.updateMany({
          where: {
            id: user.id,
            studentProfileReminderSentAt: null,
          },
          data: {
            studentProfileReminderSentAt: now,
          },
        });

        if (locked.count !== 1) {
          continue;
        }

        const recipientName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();

        try {
          await this.queue.addTransactionalTemplateEmailJob({
            to: {
              email: user.email,
              name: recipientName || undefined,
            },
            templateId,
            params: {
              ...this.emailService.getCommonTemplateParams(),
              recipientName: recipientName || 'Student',
              profileUrl,
            },
          });
        } catch (err) {
          // Best-effort rollback so the next run can retry.
          await this.prisma.user.updateMany({
            where: {
              id: user.id,
              studentProfileReminderSentAt: now,
            },
            data: {
              studentProfileReminderSentAt: null,
            },
          });

          const message = err instanceof Error ? err.message : String(err);
          this.logger.error(
            `Failed to enqueue student profile completion reminder for userId=${user.id} (${message})`
          );
        }
      }
    }

    this.logger.log('Completed student profile completion reminder scheduler');
  }
}

export const StudentProfileCompletionReminder = {
  isStudentProfileComplete,
};
