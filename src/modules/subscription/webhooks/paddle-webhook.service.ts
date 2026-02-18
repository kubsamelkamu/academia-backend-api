import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Environment, EventName, Paddle } from '@paddle/paddle-node-sdk';
import { PrismaService } from '../../../prisma/prisma.service';
import { FreePlanNotConfiguredException } from '../../../common/exceptions';

type WebhookInput = {
  rawBody: string;
  signature?: string;
};

@Injectable()
export class PaddleWebhookService {
  private readonly logger = new Logger(PaddleWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {}

  async processWebhook(input: WebhookInput) {
    const webhookSecret = this.configService.get<string>('subscription.paddleWebhookSecret');
    const apiKey = this.configService.get<string>('subscription.paddleApiKey');
    const environment = this.configService.get<string>('subscription.paddleEnvironment') || 'sandbox';

    if (!webhookSecret) {
      throw new InternalServerErrorException('Paddle webhook secret is not configured');
    }

    if (!apiKey) {
      throw new InternalServerErrorException('Paddle API key is not configured');
    }

    if (!input.signature) {
      throw new BadRequestException('Missing paddle-signature header');
    }

    const paddle = new Paddle(apiKey, {
      environment: environment === 'production' ? Environment.production : Environment.sandbox,
    });

    let eventData: any;
    try {
      eventData = await paddle.webhooks.unmarshal(input.rawBody, webhookSecret, input.signature);
    } catch (error) {
      throw new BadRequestException('Invalid Paddle webhook signature');
    }

    const providerEventId =
      eventData.eventId ??
      `${eventData.notificationId ?? 'notification'}:${eventData.eventType}:${eventData.occurredAt}`;

    const existingEvent = await this.prisma.billingWebhookEvent.findUnique({
      where: { providerEventId },
      select: { id: true, status: true },
    });

    if (existingEvent?.status === 'processed' || existingEvent?.status === 'ignored') {
      return {
        status: 'already_processed',
        eventType: eventData.eventType,
      };
    }

    await this.prisma.billingWebhookEvent.upsert({
      where: { providerEventId },
      create: {
        provider: 'paddle',
        providerEventId,
        notificationId: eventData.notificationId ?? null,
        eventType: eventData.eventType,
        status: 'received',
        payload: eventData,
      },
      update: {
        notificationId: eventData.notificationId ?? null,
        eventType: eventData.eventType,
        payload: eventData,
        status: 'received',
        errorMessage: null,
      },
    });

    return this.processStoredEvent(providerEventId, eventData);
  }

  async retryStoredEvent(providerEventId: string) {
    const existing = await this.prisma.billingWebhookEvent.findUnique({
      where: { providerEventId },
      select: {
        providerEventId: true,
        eventType: true,
        payload: true,
        status: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Webhook event not found');
    }

    const eventData = existing.payload as any;

    await this.prisma.billingWebhookEvent.update({
      where: { providerEventId },
      data: {
        status: 'received',
        errorMessage: null,
      },
    });

    return this.processStoredEvent(providerEventId, eventData);
  }

  private async processStoredEvent(providerEventId: string, eventData: any) {
    try {
      const handled = await this.handleEvent(eventData);

      await this.prisma.billingWebhookEvent.update({
        where: { providerEventId },
        data: {
          status: handled ? 'processed' : 'ignored',
          processedAt: new Date(),
        },
      });

      return {
        providerEventId,
        status: handled ? 'processed' : 'ignored',
        eventType: eventData.eventType,
      };
    } catch (error: any) {
      await this.prisma.billingWebhookEvent.update({
        where: { providerEventId },
        data: {
          status: 'failed',
          errorMessage: error?.message ?? 'Webhook processing failed',
        },
      });
      this.logger.error(`Failed to process Paddle webhook ${providerEventId}`, error?.stack);
      throw new InternalServerErrorException('Failed to process webhook event');
    }
  }

  private async handleEvent(eventData: any): Promise<boolean> {
    switch (eventData.eventType) {
      case EventName.SubscriptionCreated:
      case EventName.SubscriptionActivated:
      case EventName.SubscriptionUpdated:
      case EventName.SubscriptionPastDue:
      case EventName.SubscriptionPaused:
      case EventName.SubscriptionResumed:
      case EventName.SubscriptionCanceled:
      case EventName.SubscriptionTrialing:
        await this.syncDepartmentSubscription(eventData);
        return true;
      default:
        return false;
    }
  }

  private async syncDepartmentSubscription(eventData: any) {
    const subscriptionId = eventData?.data?.id as string | undefined;
    if (!subscriptionId) {
      return;
    }

    const customerId = (eventData?.data?.customerId as string | undefined) ?? null;
    const departmentIdFromCustomData = this.getDepartmentIdFromCustomData(eventData);

    const existing = await this.prisma.departmentSubscription.findFirst({
      where: departmentIdFromCustomData
        ? {
            OR: [
              { paddleSubscriptionId: subscriptionId },
              { departmentId: departmentIdFromCustomData },
            ],
          }
        : { paddleSubscriptionId: subscriptionId },
      select: { departmentId: true },
    });

    const departmentId = existing?.departmentId ?? departmentIdFromCustomData;

    if (!departmentId) {
      this.logger.warn(`Skipping subscription ${subscriptionId}: unable to resolve department`);
      return;
    }

    const department = await this.prisma.department.findUnique({
      where: { id: departmentId },
      select: { id: true },
    });

    if (!department) {
      this.logger.warn(`Skipping subscription ${subscriptionId}: department ${departmentId} not found`);
      return;
    }

    const freePlan = await this.getFreePlan();
    const mappedPlanId = await this.findMappedPlanId(eventData);
    const status = this.mapStatus(eventData?.data?.status);
    const periodStart = this.toDateOrNull(eventData?.data?.currentBillingPeriod?.startsAt);
    const periodEnd = this.toDateOrNull(eventData?.data?.currentBillingPeriod?.endsAt);
    const cancelAtPeriodEnd = !!eventData?.data?.scheduledChange;

    await this.prisma.departmentSubscription.upsert({
      where: { departmentId },
      create: {
        departmentId,
        planId: mappedPlanId ?? freePlan.id,
        paddleSubscriptionId: subscriptionId,
        paddleCustomerId: customerId,
        status,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd,
      },
      update: {
        planId: mappedPlanId ?? undefined,
        paddleSubscriptionId: subscriptionId,
        paddleCustomerId: customerId,
        status,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd,
      },
    });
  }

  private async findMappedPlanId(eventData: any): Promise<string | undefined> {
    const priceId = eventData?.data?.items?.[0]?.price?.id as string | undefined;
    const productId = eventData?.data?.items?.[0]?.price?.productId as string | undefined;

    const orConditions: Array<{ paddlePriceId?: string; paddleProductId?: string }> = [];
    if (priceId) {
      orConditions.push({ paddlePriceId: priceId });
    }
    if (productId) {
      orConditions.push({ paddleProductId: productId });
    }

    if (!orConditions.length) {
      return undefined;
    }

    const plan = await this.prisma.subscriptionPlan.findFirst({
      where: { OR: orConditions },
      select: { id: true },
    });

    return plan?.id;
  }

  private async getFreePlan() {
    const freePlan = await this.prisma.subscriptionPlan.findFirst({
      where: { name: 'Free' },
      select: { id: true },
    });

    if (!freePlan) {
      throw new FreePlanNotConfiguredException();
    }

    return freePlan;
  }

  private mapStatus(value: unknown): string {
    if (typeof value !== 'string') {
      return 'active';
    }

    return value.toLowerCase();
  }

  private toDateOrNull(value: unknown): Date | null {
    if (typeof value !== 'string' || !value) {
      return null;
    }

    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
      return null;
    }

    return parsedDate;
  }

  private getDepartmentIdFromCustomData(eventData: any): string | undefined {
    const value = eventData?.data?.customData?.departmentId;

    if (typeof value !== 'string' || value.trim().length === 0) {
      return undefined;
    }

    return value.trim();
  }
}
