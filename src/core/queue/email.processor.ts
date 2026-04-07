import { Process, Processor } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CoordinatorAdvisorNotificationEmailStatus } from '@prisma/client';

@Injectable()
@Processor('email')
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);
  private get prismaClient(): any {
    return this.prisma as any;
  }

  constructor(
    private readonly emailService: EmailService,
    private readonly prisma: PrismaService
  ) {
    this.logger.log('EmailProcessor initialized (email queue worker active)');
  }

  @Process('send-transactional-email')
  async handleSendTransactionalEmail(job: Job<any>): Promise<void> {
    const { to, subject, htmlContent, textContent, replyTo } = job.data;

    this.logger.log(`Processing send-transactional-email jobId=${String(job.id)}`);

    try {
      await this.emailService.sendTransactionalEmail({
        to,
        subject,
        htmlContent,
        textContent,
        replyTo,
      });

      this.logger.log(`Completed send-transactional-email jobId=${String(job.id)}`);
    } catch (error) {
      const stack = error instanceof Error ? error.stack : String(error);
      this.logger.error(`Failed send-transactional-email jobId=${String(job.id)}`, stack);
      throw error;
    }
  }

  @Process('send-coordinator-advisor-notification-email')
  async handleSendCoordinatorAdvisorNotificationEmail(job: Job<any>): Promise<void> {
    const { campaignId, advisorUserId, to, subject, htmlContent, textContent, replyTo } = job.data;

    this.logger.log(
      `Processing send-coordinator-advisor-notification-email jobId=${String(job.id)}`
    );

    try {
      const result = await this.emailService.sendTransactionalEmail({
        to,
        subject,
        htmlContent,
        textContent,
        replyTo,
      });

      await this.prismaClient.coordinatorAdvisorNotificationRecipient.update({
        where: {
          campaignId_advisorUserId: {
            campaignId,
            advisorUserId,
          },
        },
        data: {
          emailStatus: CoordinatorAdvisorNotificationEmailStatus.ACCEPTED,
          emailProviderMessageId: result.messageId,
          emailFailureReason: null,
        },
      });

      await this.recomputeCoordinatorAdvisorCampaignCounts(campaignId);

      this.logger.log(
        `Completed send-coordinator-advisor-notification-email jobId=${String(job.id)}`
      );
    } catch (error) {
      const stack = error instanceof Error ? error.stack : String(error);

      await this.prismaClient.coordinatorAdvisorNotificationRecipient.update({
        where: {
          campaignId_advisorUserId: {
            campaignId,
            advisorUserId,
          },
        },
        data: {
          emailStatus: CoordinatorAdvisorNotificationEmailStatus.FAILED,
          emailFailureReason: error instanceof Error ? error.message : String(error),
        },
      });

      await this.recomputeCoordinatorAdvisorCampaignCounts(campaignId);

      this.logger.error(
        `Failed send-coordinator-advisor-notification-email jobId=${String(job.id)}`,
        stack
      );
      throw error;
    }
  }

  @Process('send-transactional-template-email')
  async handleSendTransactionalTemplateEmail(job: Job<any>): Promise<void> {
    const { to, templateId, params, replyTo } = job.data;

    this.logger.log(`Processing send-transactional-template-email jobId=${String(job.id)}`);

    try {
      await this.emailService.sendTransactionalTemplateEmail({
        to,
        templateId,
        params,
        replyTo,
      });

      this.logger.log(`Completed send-transactional-template-email jobId=${String(job.id)}`);
    } catch (error) {
      const stack = error instanceof Error ? error.stack : String(error);
      this.logger.error(`Failed send-transactional-template-email jobId=${String(job.id)}`, stack);
      throw error;
    }
  }

  @Process('send-contact-email')
  async handleSendContactEmail(job: Job<any>): Promise<void> {
    const { name, email, subject, message } = job.data;

    this.logger.log(`Processing send-contact-email jobId=${String(job.id)}`);

    try {
      await this.emailService.sendContactEmailToSupport({
        name,
        email,
        subject,
        message,
      });

      await this.emailService.sendAcknowledgmentEmail({
        name,
        email,
      });

      this.logger.log(`Completed send-contact-email jobId=${String(job.id)}`);
    } catch (error) {
      const stack = error instanceof Error ? error.stack : String(error);
      this.logger.error(`Failed send-contact-email jobId=${String(job.id)}`, stack);
      throw error;
    }
  }

  private async recomputeCoordinatorAdvisorCampaignCounts(campaignId: string): Promise<void> {
    const aggregate = await this.prismaClient.coordinatorAdvisorNotificationRecipient.aggregate({
      where: { campaignId },
      _count: { _all: true },
    });

    const [inAppDeliveredCount, inAppFailedCount, emailQueuedCount, emailAcceptedCount, emailDeliveredCount, emailFailedCount] =
      await Promise.all([
        this.prismaClient.coordinatorAdvisorNotificationRecipient.count({
          where: { campaignId, inAppStatus: 'DELIVERED' },
        }),
        this.prismaClient.coordinatorAdvisorNotificationRecipient.count({
          where: { campaignId, inAppStatus: 'FAILED' },
        }),
        this.prismaClient.coordinatorAdvisorNotificationRecipient.count({
          where: { campaignId, emailStatus: 'QUEUED' },
        }),
        this.prismaClient.coordinatorAdvisorNotificationRecipient.count({
          where: { campaignId, emailStatus: 'ACCEPTED' },
        }),
        this.prismaClient.coordinatorAdvisorNotificationRecipient.count({
          where: { campaignId, emailStatus: 'DELIVERED' },
        }),
        this.prismaClient.coordinatorAdvisorNotificationRecipient.count({
          where: { campaignId, emailStatus: 'FAILED' },
        }),
      ]);

    await this.prismaClient.coordinatorAdvisorNotificationCampaign.update({
      where: { id: campaignId },
      data: {
        requestedRecipientsCount: aggregate._count._all,
        totalReachedCount: aggregate._count._all,
        inAppDeliveredCount,
        inAppFailedCount,
        emailQueuedCount,
        emailAcceptedCount,
        emailDeliveredCount,
        emailFailedCount,
      },
    });
  }
}
