import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CoordinatorAdvisorNotificationEmailStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class EmailDeliveryWebhookService {
  private readonly logger = new Logger(EmailDeliveryWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  private get prismaClient(): any {
    return this.prisma as any;
  }

  assertWebhookSecret(secret?: string): void {
    const expectedSecret =
      this.config.get<string>('email.webhookSecret') ||
      process.env.EMAIL_WEBHOOK_SECRET ||
      process.env.BREVO_WEBHOOK_SECRET;

    if (!expectedSecret) {
      return;
    }

    if (!secret || secret !== expectedSecret) {
      throw new ForbiddenException('Invalid email webhook secret');
    }
  }

  async handleWebhook(payload: unknown): Promise<{ processed: number; matched: number }> {
    const events = Array.isArray(payload) ? payload : [payload];

    let processed = 0;
    let matched = 0;

    for (const item of events) {
      const event = item as Record<string, unknown>;
      const messageId = this.normalizeMessageId(
        event?.['message-id'] ?? event?.messageId ?? event?.message_id ?? event?.['msg-id']
      );
      const status = this.mapEmailStatus(event?.event ?? event?.type);

      if (!messageId || !status) {
        continue;
      }

      processed += 1;

      const recipient = await this.prismaClient.coordinatorAdvisorNotificationRecipient.findFirst({
        where: { emailProviderMessageId: messageId },
        select: {
          campaignId: true,
          advisorUserId: true,
          emailStatus: true,
        },
      });

      if (!recipient) {
        this.logger.warn(`Email webhook messageId not matched: ${messageId}`);
        continue;
      }

      matched += 1;

      await this.prismaClient.coordinatorAdvisorNotificationRecipient.update({
        where: {
          campaignId_advisorUserId: {
            campaignId: recipient.campaignId,
            advisorUserId: recipient.advisorUserId,
          },
        },
        data: {
          emailStatus: status,
          emailFailureReason:
            status === CoordinatorAdvisorNotificationEmailStatus.FAILED
              ? String(event?.reason ?? event?.error ?? event?.event ?? 'delivery_failed')
              : null,
        },
      });

      await this.recomputeCoordinatorAdvisorCampaignCounts(recipient.campaignId);
    }

    return { processed, matched };
  }

  private normalizeMessageId(value: unknown): string | null {
    if (!value) return null;

    const normalized = String(value).trim();
    if (!normalized) return null;

    return normalized.replace(/^<|>$/g, '');
  }

  private mapEmailStatus(value: unknown): CoordinatorAdvisorNotificationEmailStatus | null {
    const normalized = String(value ?? '')
      .trim()
      .toLowerCase();

    if (!normalized) return null;

    if (normalized === 'delivered') {
      return CoordinatorAdvisorNotificationEmailStatus.DELIVERED;
    }

    if (
      [
        'hard_bounce',
        'soft_bounce',
        'blocked',
        'invalid_email',
        'error',
        'spam',
        'unsubscribed',
        'deferred',
      ].includes(normalized)
    ) {
      return CoordinatorAdvisorNotificationEmailStatus.FAILED;
    }

    return null;
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