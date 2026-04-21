import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CoordinatorEvaluatorNotificationDeliveryMethod,
  CoordinatorEvaluatorNotificationEmailStatus,
  CoordinatorEvaluatorNotificationInAppStatus,
  NotificationEventType,
  NotificationSeverity,
} from '@prisma/client';

import { NOTIFICATION_EVENT_TYPES } from '../../common/constants/notifications.constants';
import { QueueService } from '../../core/queue/queue.service';
import { NotificationService } from '../notification/notification.service';

import { CoordinatorEvaluatorNotificationsRepository } from './coordinator-evaluator-notifications.repository';
import {
  CoordinatorEvaluatorNotificationDeliveryMethodDto,
  CoordinatorEvaluatorNotificationRecipientModeDto,
  CreateCoordinatorEvaluatorNotificationDto,
} from './dto/create-coordinator-evaluator-notification.dto';
import {
  ListCoordinatorEvaluatorNotificationRecipientsQueryDto,
  ListCoordinatorEvaluatorNotificationsQueryDto,
} from './dto/list-coordinator-evaluator-notifications.dto';

@Injectable()
export class CoordinatorEvaluatorNotificationsService {
  constructor(
    private readonly repository: CoordinatorEvaluatorNotificationsRepository,
    private readonly notificationService: NotificationService,
    private readonly queueService: QueueService
  ) {}

  private async assertDepartmentAccess(user: any) {
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

    const ok = await this.repository.departmentExistsInTenant(ctx.departmentId, tenantId);
    if (!ok) {
      throw new ForbiddenException('Department not found for tenant');
    }

    return {
      tenantId,
      departmentId: ctx.departmentId,
    };
  }

  private async resolveEligibleEvaluators(params: {
    tenantId: string;
    departmentId: string;
    stage: CreateCoordinatorEvaluatorNotificationDto['stage'];
    evaluatorUserIds?: string[];
    search?: string;
  }) {
    return this.repository.findEligibleDepartmentEvaluators(params);
  }

  private async resolveRecipients(
    tenantId: string,
    departmentId: string,
    dto: CreateCoordinatorEvaluatorNotificationDto,
    actorUserId: string
  ) {
    const evaluatorUserIds = Array.from(new Set(dto.evaluatorUserIds ?? []));

    if (
      dto.recipientMode === CoordinatorEvaluatorNotificationRecipientModeDto.SINGLE &&
      evaluatorUserIds.length !== 1
    ) {
      throw new BadRequestException('Exactly one evaluatorUserId is required for SINGLE mode');
    }

    if (
      dto.recipientMode === CoordinatorEvaluatorNotificationRecipientModeDto.MULTIPLE &&
      evaluatorUserIds.length === 0
    ) {
      throw new BadRequestException('At least one evaluatorUserId is required for MULTIPLE mode');
    }

    const evaluators = await this.resolveEligibleEvaluators({
      tenantId,
      departmentId,
      stage: dto.stage,
      evaluatorUserIds:
        dto.recipientMode === CoordinatorEvaluatorNotificationRecipientModeDto.ALL
          ? undefined
          : evaluatorUserIds,
    });

    const recipients = evaluators
      .filter((evaluator) => evaluator.evaluatorUserId !== actorUserId)
      .map((evaluator) => ({
        evaluatorUserId: evaluator.evaluatorUserId,
        email: evaluator.email,
        fullName: evaluator.fullName,
      }));

    if (dto.recipientMode !== CoordinatorEvaluatorNotificationRecipientModeDto.ALL) {
      const foundIds = new Set(recipients.map((recipient) => recipient.evaluatorUserId));
      const missingIds = evaluatorUserIds.filter((id) => !foundIds.has(id));
      if (missingIds.length > 0) {
        throw new ForbiddenException(
          'One or more selected evaluators are outside your department scope'
        );
      }
    }

    if (recipients.length === 0) {
      throw new BadRequestException('No evaluators matched the selected recipient criteria');
    }

    return recipients;
  }

  async send(user: any, dto: CreateCoordinatorEvaluatorNotificationDto) {
    const { tenantId, departmentId } = await this.assertDepartmentAccess(user);
    const recipients = await this.resolveRecipients(tenantId, departmentId, dto, user.sub);

    const campaign = await this.repository.createCampaignWithRecipients({
      tenantId,
      departmentId,
      createdByUserId: user.sub,
      stage: dto.stage,
      recipientMode: dto.recipientMode,
      deliveryMethod: dto.deliveryMethod as CoordinatorEvaluatorNotificationDeliveryMethod,
      priority: dto.priority,
      subject: dto.subject,
      message: dto.message,
      recipients,
    });

    let inAppDeliveredCount = 0;
    let inAppFailedCount = 0;
    let emailQueuedCount = 0;
    let emailDeliveredCount = 0;
    let emailFailedCount = 0;

    for (const recipient of recipients) {
      if (
        dto.deliveryMethod === CoordinatorEvaluatorNotificationDeliveryMethodDto.IN_APP ||
        dto.deliveryMethod === CoordinatorEvaluatorNotificationDeliveryMethodDto.BOTH
      ) {
        try {
          const notification = await this.notificationService.createNotification({
            tenantId,
            userId: recipient.evaluatorUserId,
            eventType:
              NOTIFICATION_EVENT_TYPES.COORDINATOR_EVALUATOR_NOTIFICATION as NotificationEventType,
            severity: dto.priority as NotificationSeverity,
            title: dto.subject,
            message: dto.message,
            metadata: {
              campaignId: campaign.id,
              senderUserId: user.sub,
              recipientMode: dto.recipientMode,
              deliveryMethod: dto.deliveryMethod,
              stage: dto.stage,
            },
            idempotencyKey: `coordinator_evaluator_notification:${campaign.id}:${recipient.evaluatorUserId}`,
          });

          inAppDeliveredCount += 1;
          await this.repository.updateRecipientDelivery({
            campaignId: campaign.id,
            evaluatorUserId: recipient.evaluatorUserId,
            inAppStatus: CoordinatorEvaluatorNotificationInAppStatus.DELIVERED,
            inAppNotificationId: notification.id,
          });
        } catch {
          inAppFailedCount += 1;
          await this.repository.updateRecipientDelivery({
            campaignId: campaign.id,
            evaluatorUserId: recipient.evaluatorUserId,
            inAppStatus: CoordinatorEvaluatorNotificationInAppStatus.FAILED,
          });
        }
      }

      if (
        dto.deliveryMethod === CoordinatorEvaluatorNotificationDeliveryMethodDto.EMAIL ||
        dto.deliveryMethod === CoordinatorEvaluatorNotificationDeliveryMethodDto.BOTH
      ) {
        try {
          await this.queueService.addCoordinatorEvaluatorNotificationEmailJob({
            campaignId: campaign.id,
            evaluatorUserId: recipient.evaluatorUserId,
            to: {
              email: recipient.email,
              name: recipient.fullName,
            },
            subject: dto.subject,
            htmlContent: `<p>${dto.message.replace(/\n/g, '<br/>')}</p>`,
            textContent: dto.message,
          });

          emailQueuedCount += 1;
          await this.repository.updateRecipientDelivery({
            campaignId: campaign.id,
            evaluatorUserId: recipient.evaluatorUserId,
            emailStatus: CoordinatorEvaluatorNotificationEmailStatus.QUEUED,
          });
        } catch (error) {
          emailFailedCount += 1;
          await this.repository.updateRecipientDelivery({
            campaignId: campaign.id,
            evaluatorUserId: recipient.evaluatorUserId,
            emailStatus: CoordinatorEvaluatorNotificationEmailStatus.FAILED,
            emailFailureReason: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    await this.repository.updateCampaignCounts({
      campaignId: campaign.id,
      inAppDeliveredCount,
      inAppFailedCount,
      emailQueuedCount,
      emailAcceptedCount: 0,
      emailDeliveredCount,
      emailFailedCount,
    });

    return {
      success: true,
      message: 'Notification dispatched successfully',
      data: {
        campaignId: campaign.id,
        stage: dto.stage,
        recipientMode: dto.recipientMode,
        requestedRecipients: recipients.length,
        inAppDelivered: inAppDeliveredCount,
        emailQueued: emailQueuedCount,
        emailDelivered: emailDeliveredCount,
        emailFailed: emailFailedCount,
        totalReached: recipients.length,
        createdAt: campaign.createdAt,
      },
      timestamp: new Date().toISOString(),
    };
  }

  async listRecipients(user: any, query: ListCoordinatorEvaluatorNotificationRecipientsQueryDto) {
    const { tenantId, departmentId } = await this.assertDepartmentAccess(user);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const allItems = await this.resolveEligibleEvaluators({
      tenantId,
      departmentId,
      stage: query.stage,
      search: query.search,
    });

    const total = allItems.length;
    const start = (page - 1) * limit;
    const items = allItems.slice(start, start + limit);

    return {
      success: true,
      message: 'Evaluator recipients retrieved successfully',
      data: {
        stage: query.stage,
        items,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
        summary: {
          totalEligibleEvaluators: total,
        },
      },
      timestamp: new Date().toISOString(),
    };
  }

  async getHistorySummary(user: any, query: ListCoordinatorEvaluatorNotificationsQueryDto) {
    const { tenantId, departmentId } = await this.assertDepartmentAccess(user);

    return {
      success: true,
      message: 'Evaluator notification history summary retrieved',
      data: {
        stage: query.stage ?? null,
        ...(await this.repository.summarizeCampaigns({
          tenantId,
          departmentId,
          stage: query.stage,
        })),
      },
      timestamp: new Date().toISOString(),
    };
  }

  async listHistory(user: any, query: ListCoordinatorEvaluatorNotificationsQueryDto) {
    const { tenantId, departmentId } = await this.assertDepartmentAccess(user);

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const { items, total } = await this.repository.listCampaignsPaged({
      tenantId,
      departmentId,
      skip,
      take: limit,
      stage: query.stage,
      deliveryMethod: query.deliveryMethod as CoordinatorEvaluatorNotificationDeliveryMethod,
      priority: query.priority,
      search: query.search,
    });

    return {
      success: true,
      message: 'Evaluator notification history retrieved',
      data: {
        items,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      },
      timestamp: new Date().toISOString(),
    };
  }

  async getHistoryDetail(user: any, campaignId: string) {
    const { tenantId, departmentId } = await this.assertDepartmentAccess(user);
    const campaign = await this.repository.findCampaignById({
      campaignId,
      tenantId,
      departmentId,
    });

    if (!campaign) {
      throw new NotFoundException('Evaluator notification history item not found');
    }

    return {
      success: true,
      message: 'Evaluator notification history detail retrieved',
      data: {
        ...campaign,
        recipients: campaign.recipients.map((recipient: any) => ({
          evaluatorUserId: recipient.evaluatorUserId,
          fullName: recipient.fullName,
          email: recipient.email,
          inAppStatus: recipient.inAppStatus,
          emailStatus: recipient.emailStatus,
          emailFailureReason: recipient.emailFailureReason,
          readAt: recipient.inAppNotification?.readAt ?? recipient.readAt ?? null,
        })),
      },
      timestamp: new Date().toISOString(),
    };
  }
}