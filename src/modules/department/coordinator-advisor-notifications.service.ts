import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CoordinatorAdvisorNotificationDeliveryMethod,
  CoordinatorAdvisorNotificationEmailStatus,
  CoordinatorAdvisorNotificationInAppStatus,
  NotificationEventType,
  NotificationSeverity,
} from '@prisma/client';

import { NOTIFICATION_EVENT_TYPES } from '../../common/constants/notifications.constants';
import { NotificationService } from '../notification/notification.service';
import { QueueService } from '../../core/queue/queue.service';

import {
  CoordinatorAdvisorNotificationDeliveryMethodDto,
  CoordinatorAdvisorNotificationRecipientModeDto,
  CreateCoordinatorAdvisorNotificationDto,
} from './dto/create-coordinator-advisor-notification.dto';
import { ListCoordinatorAdvisorNotificationsQueryDto } from './dto/list-coordinator-advisor-notifications.dto';
import { CoordinatorAdvisorNotificationsRepository } from './coordinator-advisor-notifications.repository';

@Injectable()
export class CoordinatorAdvisorNotificationsService {
  constructor(
    private readonly repository: CoordinatorAdvisorNotificationsRepository,
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

  private async resolveRecipients(
    tenantId: string,
    departmentId: string,
    dto: CreateCoordinatorAdvisorNotificationDto,
    actorUserId: string
  ) {
    const advisorUserIds = Array.from(new Set(dto.advisorUserIds ?? []));

    if (
      dto.recipientMode === CoordinatorAdvisorNotificationRecipientModeDto.SINGLE &&
      advisorUserIds.length !== 1
    ) {
      throw new BadRequestException('Exactly one advisorUserId is required for SINGLE mode');
    }

    if (
      dto.recipientMode === CoordinatorAdvisorNotificationRecipientModeDto.MULTIPLE &&
      advisorUserIds.length === 0
    ) {
      throw new BadRequestException('At least one advisorUserId is required for MULTIPLE mode');
    }

    const advisors = await this.repository.findDepartmentAdvisors({
      tenantId,
      departmentId,
      advisorUserIds:
        dto.recipientMode === CoordinatorAdvisorNotificationRecipientModeDto.ALL
          ? undefined
          : advisorUserIds,
    });

    const recipients = advisors
      .filter((advisor) => advisor.userId !== actorUserId)
      .map((advisor) => ({
        advisorUserId: advisor.user.id,
        email: advisor.user.email,
        fullName: `${advisor.user.firstName} ${advisor.user.lastName}`.trim(),
      }));

    if (dto.recipientMode !== CoordinatorAdvisorNotificationRecipientModeDto.ALL) {
      const foundIds = new Set(recipients.map((recipient) => recipient.advisorUserId));
      const missingIds = advisorUserIds.filter((id) => !foundIds.has(id));
      if (missingIds.length > 0) {
        throw new ForbiddenException('One or more selected advisors are outside your department');
      }
    }

    if (recipients.length === 0) {
      throw new BadRequestException('No advisors matched the selected recipient criteria');
    }

    return recipients;
  }

  async send(user: any, dto: CreateCoordinatorAdvisorNotificationDto) {
    const { tenantId, departmentId } = await this.assertDepartmentAccess(user);
    const recipients = await this.resolveRecipients(tenantId, departmentId, dto, user.sub);

    const campaign = await this.repository.createCampaignWithRecipients({
      tenantId,
      departmentId,
      createdByUserId: user.sub,
      recipientMode: dto.recipientMode,
      deliveryMethod: dto.deliveryMethod as CoordinatorAdvisorNotificationDeliveryMethod,
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
        dto.deliveryMethod === CoordinatorAdvisorNotificationDeliveryMethodDto.IN_APP ||
        dto.deliveryMethod === CoordinatorAdvisorNotificationDeliveryMethodDto.BOTH
      ) {
        try {
          const notification = await this.notificationService.createNotification({
            tenantId,
            userId: recipient.advisorUserId,
            eventType:
              NOTIFICATION_EVENT_TYPES.COORDINATOR_ADVISOR_NOTIFICATION as NotificationEventType,
            severity: dto.priority as NotificationSeverity,
            title: dto.subject,
            message: dto.message,
            metadata: {
              campaignId: campaign.id,
              senderUserId: user.sub,
              recipientMode: dto.recipientMode,
              deliveryMethod: dto.deliveryMethod,
            },
            idempotencyKey: `coordinator_advisor_notification:${campaign.id}:${recipient.advisorUserId}`,
          });

          inAppDeliveredCount += 1;
          await this.repository.updateRecipientDelivery({
            campaignId: campaign.id,
            advisorUserId: recipient.advisorUserId,
            inAppStatus: CoordinatorAdvisorNotificationInAppStatus.DELIVERED,
            inAppNotificationId: notification.id,
          });
        } catch {
          inAppFailedCount += 1;
          await this.repository.updateRecipientDelivery({
            campaignId: campaign.id,
            advisorUserId: recipient.advisorUserId,
            inAppStatus: CoordinatorAdvisorNotificationInAppStatus.FAILED,
          });
        }
      }

      if (
        dto.deliveryMethod === CoordinatorAdvisorNotificationDeliveryMethodDto.EMAIL ||
        dto.deliveryMethod === CoordinatorAdvisorNotificationDeliveryMethodDto.BOTH
      ) {
        try {
          await this.queueService.addCoordinatorAdvisorNotificationEmailJob({
            campaignId: campaign.id,
            advisorUserId: recipient.advisorUserId,
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
            advisorUserId: recipient.advisorUserId,
            emailStatus: CoordinatorAdvisorNotificationEmailStatus.QUEUED,
          });
        } catch (error) {
          emailFailedCount += 1;
          await this.repository.updateRecipientDelivery({
            campaignId: campaign.id,
            advisorUserId: recipient.advisorUserId,
            emailStatus: CoordinatorAdvisorNotificationEmailStatus.FAILED,
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

  async getHistorySummary(user: any) {
    const { tenantId, departmentId } = await this.assertDepartmentAccess(user);

    return {
      success: true,
      message: 'Notification history summary retrieved',
      data: await this.repository.summarizeCampaigns({ tenantId, departmentId }),
      timestamp: new Date().toISOString(),
    };
  }

  async listHistory(user: any, query: ListCoordinatorAdvisorNotificationsQueryDto) {
    const { tenantId, departmentId } = await this.assertDepartmentAccess(user);

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const { items, total } = await this.repository.listCampaignsPaged({
      tenantId,
      departmentId,
      skip,
      take: limit,
      deliveryMethod: query.deliveryMethod as CoordinatorAdvisorNotificationDeliveryMethod,
      priority: query.priority,
      search: query.search,
    });

    return {
      success: true,
      message: 'Notification history retrieved',
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
      throw new NotFoundException('Notification history item not found');
    }

    return {
      success: true,
      message: 'Notification history detail retrieved',
      data: {
        ...campaign,
        recipients: campaign.recipients.map((recipient: any) => ({
          advisorUserId: recipient.advisorUserId,
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