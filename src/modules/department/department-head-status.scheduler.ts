import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuthRepository } from '../auth/auth.repository';
import { NotificationService } from '../notification/notification.service';
import { EmailService } from '../../core/email/email.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ROLES } from '../../common/constants/roles.constants';

@Injectable()
export class DepartmentHeadStatusScheduler {
  private readonly logger = new Logger(DepartmentHeadStatusScheduler.name);

  constructor(
    private readonly authRepository: AuthRepository,
    private readonly notificationService: NotificationService,
    private readonly emailService: EmailService,
    private readonly prisma: PrismaService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleStatusRemindersAndSuspension() {
    // IMPORTANT: worker dynos should only process queues, not run schedulers.
    if ((process.env.DYNO ?? '').startsWith('worker.') || process.env.WORKER === 'true') {
      return;
    }

    this.logger.log('Running Department Head status upload check...');
    const now = new Date();
    // Find all Department Heads who have not uploaded status and have a deadline set
    const users = await this.prisma.user.findMany({
      where: {
        roles: { some: { role: { name: ROLES.DEPARTMENT_HEAD } } },
        firstLoginAt: { not: null },
        statusUploadDeadline: { not: null },
        // Add your own logic to check if status is uploaded (e.g., a flag or verification request)
      },
      include: { tenant: true },
    });

    for (const user of users) {
      // Check if Department Head has uploaded status (has a verification request)
      const latestVerification = await this.authRepository.findLatestTenantVerificationRequest(user.tenantId);
      const hasUploadedStatus = !!latestVerification;
      if (hasUploadedStatus) continue;

      const deadline = user.statusUploadDeadline;
      if (!deadline) continue;
      const hoursLeft = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

      // Send reminders
      if (hoursLeft <= 24 && hoursLeft > 1) {
        // First reminder (1 day before)
        await this.sendReminder(user, 'first');
      } else if (hoursLeft <= 1 && hoursLeft > 0) {
        // Second reminder (1 hour before)
        await this.sendReminder(user, 'second');
      } else if (hoursLeft <= 0) {
        // Deadline passed, suspend tenant
        await this.suspendTenant(user.tenantId);
        await this.sendSuspensionNotification(user);
      }
    }
  }

  private async sendReminder(user: any, type: 'first' | 'second') {
    // In-app notification
    const idempotencyKey = `status_upload_reminder:${user.id}:${type}`;
    await this.notificationService.createNotification({
      tenantId: user.tenantId,
      userId: user.id,
      eventType: 'INSTITUTION_VERIFICATION_SUBMITTED', // Custom event type for status upload reminder
      severity: 'INFO',
      title: type === 'first'
        ? 'Status Upload Reminder: 24 Hours Left'
        : 'Final Status Upload Reminder: 1 Hour Left',
      message:
        type === 'first'
          ? 'Please upload your status document within 24 hours to avoid account suspension.'
          : 'Final reminder: Upload your status document within 1 hour to avoid account suspension.',
      idempotencyKey,
    });
    this.logger.log(`Sent ${type} reminder notification to Department Head ${user.email}`);
    // Email notification
    await this.emailService.sendStatusUploadReminder({
      email: user.email,
      name: user.firstName || undefined,
      type,
    });
    this.logger.log(`Sent ${type} reminder email to Department Head ${user.email}`);
  }

  private async suspendTenant(tenantId: string) {
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status: 'SUSPENDED' },
    });
    this.logger.warn(`Suspended tenant ${tenantId} due to missing status upload.`);
  }

  private async sendSuspensionNotification(user: any) {
    // In-app notification
    const idempotencyKey = `status_upload_suspended:${user.id}`;
    await this.notificationService.createNotification({
      tenantId: user.tenantId,
      userId: user.id,
      eventType: 'SYSTEM_ACCOUNT_LOCKED',
      severity: 'CRITICAL',
      title: 'Account Suspended',
      message: 'Your account has been suspended due to failure to upload your status document in time.',
      idempotencyKey,
    });
    this.logger.warn(`Sent suspension notification to Department Head ${user.email}`);
    // Email notification
    await this.emailService.sendAccountSuspended({
      email: user.email,
      name: user.firstName || undefined,
    });
    this.logger.warn(`Sent suspension email to Department Head ${user.email}`);
  }
}
