import { Injectable, Logger } from '@nestjs/common';
import { NotificationRepository } from './notification.repository';
import { NotificationGateway } from './notification.gateway';
import {
  NotificationEventType,
  NotificationSeverity,
  NotificationStatus,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  NOTIFICATION_EVENT_TYPES,
  NOTIFICATION_SEVERITIES,
} from '../../common/constants/notifications.constants';
import { ROLES } from '../../common/constants/roles.constants';
import { WebPushService } from './web-push.service';

export interface CreateNotificationData {
  tenantId: string;
  userId: string;
  eventType: NotificationEventType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  metadata?: any;
  idempotencyKey: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly notificationRepository: NotificationRepository,
    private readonly notificationGateway: NotificationGateway,
    private readonly prisma: PrismaService,
    private readonly webPush: WebPushService
  ) {}

  async createNotification(data: CreateNotificationData) {
    const existing = await this.notificationRepository.findByIdempotencyKey(data.idempotencyKey);
    if (existing) {
      this.logger.warn(`Duplicate notification attempt for key: ${data.idempotencyKey}`);
      return existing;
    }

    const notification = await this.notificationRepository.createNotification(data);
    this.logger.log(`Created notification ${notification.id} for user ${data.userId}`);

    // Best-effort Web Push (works even when tab is closed, if the frontend subscribes).
    // Never block the main flow.
    try {
      void this.webPush.sendToUserBestEffort({
        tenantId: data.tenantId,
        userId: data.userId,
        payload: {
          notificationId: notification.id,
          title: notification.title,
          message: notification.message,
          eventType: String(notification.eventType),
          severity: String(notification.severity),
          createdAt: notification.createdAt.toISOString(),
          metadata: notification.metadata,
        },
      });
    } catch {
      // ignore
    }

    try {
      // In worker mode (application context), the websocket server may not be initialized.
      // Persisting the notification is still valuable; real-time emission is best-effort.
      const server = (this.notificationGateway as any)?.server;
      if (server) {
        this.notificationGateway.emitNotificationToUser(data.userId, {
          id: notification.id,
          eventType: notification.eventType,
          severity: notification.severity,
          title: notification.title,
          message: notification.message,
          metadata: notification.metadata,
          status: notification.status,
          createdAt: notification.createdAt,
        });
      }
    } catch (error) {
      this.logger.warn(
        `Notification real-time emit skipped/failed for ${notification.id}: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return notification;
  }

  async getUserNotifications(
    tenantId: string,
    userId: string,
    options?: {
      status?: NotificationStatus;
      eventTypes?: NotificationEventType[];
      limit?: number;
      offset?: number;
    }
  ) {
    return this.notificationRepository.findNotificationsByUser(tenantId, userId, options);
  }

  async getUnreadCount(
    tenantId: string,
    userId: string,
    eventTypes?: NotificationEventType[]
  ): Promise<number> {
    return this.notificationRepository.countUnreadNotifications(tenantId, userId, eventTypes);
  }

  async markAsRead(notificationId: string, userId: string) {
    const notification = await this.notificationRepository.markAsRead(notificationId, userId);
    if (notification) {
      // TODO: Emit real-time update
      // await this.emitNotificationUpdate(notification);
    }
    return notification;
  }

  async markAllAsRead(tenantId: string, userId: string): Promise<number> {
    const count = await this.notificationRepository.markAllAsRead(tenantId, userId);
    this.logger.log(`Marked ${count} notifications as read for user ${userId}`);
    // TODO: Emit real-time update for unread count
    return count;
  }

  async countNotificationsByUser(
    tenantId: string,
    userId: string,
    status?: NotificationStatus,
    eventTypes?: NotificationEventType[]
  ): Promise<number> {
    return this.notificationRepository.countNotificationsByUser(
      tenantId,
      userId,
      status,
      eventTypes
    );
  }

  async notifyDepartmentGroupSizeUpdated(params: {
    tenantId: string;
    userIds: string[];
    departmentId: string;
    departmentName?: string;
    minGroupSize: number;
    maxGroupSize: number;
    actorUserId?: string;
  }): Promise<void> {
    const uniqueUserIds = Array.from(new Set((params.userIds ?? []).filter(Boolean)));
    if (uniqueUserIds.length === 0) return;

    const results = await Promise.allSettled(
      uniqueUserIds.map((userId) => {
        const idempotencyKey = `department_group_size_updated:${params.departmentId}:${params.minGroupSize}:${params.maxGroupSize}:${userId}`;
        return this.createNotification({
          tenantId: params.tenantId,
          userId,
          eventType: NotificationEventType.DEPARTMENT_GROUP_SIZE_UPDATED,
          severity: NotificationSeverity.INFO,
          title: params.departmentName
            ? `Group Size Updated (${params.departmentName})`
            : 'Group Size Updated',
          message: params.departmentName
            ? `${params.departmentName} group size updated: min ${params.minGroupSize}, max ${params.maxGroupSize}.`
            : `Department group size updated: min ${params.minGroupSize}, max ${params.maxGroupSize}.`,
          metadata: {
            departmentId: params.departmentId,
            departmentName: params.departmentName,
            minGroupSize: params.minGroupSize,
            maxGroupSize: params.maxGroupSize,
            actorUserId: params.actorUserId,
          },
          idempotencyKey,
        });
      })
    );

    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    if (rejected.length > 0) {
      const reasons = rejected
        .map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason)))
        .slice(0, 5)
        .join(' | ');

      this.logger.warn(
        `DepartmentGroupSizeUpdated notifications: ${rejected.length}/${results.length} failed (${reasons})`
      );
    }
  }

  async notifyMilestoneTemplateCreated(params: {
    tenantId: string;
    userIds: string[];
    departmentId: string;
    departmentName?: string;
    templateId: string;
    templateName: string;
    milestoneCount: number;
    actorUserId?: string;
  }): Promise<void> {
    const uniqueUserIds = Array.from(new Set((params.userIds ?? []).filter(Boolean)));
    if (uniqueUserIds.length === 0) return;

    const results = await Promise.allSettled(
      uniqueUserIds.map((userId) => {
        const idempotencyKey = `milestone_template_created:${params.templateId}:${userId}`;
        return this.createNotification({
          tenantId: params.tenantId,
          userId,
          eventType: NOTIFICATION_EVENT_TYPES.MILESTONE_TEMPLATE_CREATED as NotificationEventType,
          severity: NOTIFICATION_SEVERITIES.INFO as NotificationSeverity,
          title: params.departmentName
            ? `New Milestone Template (${params.departmentName})`
            : 'New Milestone Template',
          message: `A new milestone template \"${params.templateName}\" was created with ${params.milestoneCount} milestones.`,
          metadata: {
            departmentId: params.departmentId,
            departmentName: params.departmentName,
            templateId: params.templateId,
            templateName: params.templateName,
            milestoneCount: params.milestoneCount,
            actorUserId: params.actorUserId,
          },
          idempotencyKey,
        });
      })
    );

    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    if (rejected.length > 0) {
      const reasons = rejected
        .map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason)))
        .slice(0, 5)
        .join(' | ');

      this.logger.warn(
        `MilestoneTemplateCreated notifications: ${rejected.length}/${results.length} failed (${reasons})`
      );
    }
  }

  async notifyProjectGroupFormed(params: {
    tenantId: string;
    userIds: string[];
    departmentId: string;
    projectGroupId: string;
    projectGroupName: string;
    reviewerUserId?: string;
  }): Promise<void> {
    const uniqueUserIds = Array.from(new Set((params.userIds ?? []).filter(Boolean)));
    if (!uniqueUserIds.length) return;

    const results = await Promise.allSettled(
      uniqueUserIds.map((userId) => {
        const idempotencyKey = `project_group_formed:${params.projectGroupId}:${userId}`;
        return this.createNotification({
          tenantId: params.tenantId,
          userId,
          eventType:
            NOTIFICATION_EVENT_TYPES.PROJECT_GROUP_FORMED as unknown as NotificationEventType,
          severity: NOTIFICATION_SEVERITIES.INFO as NotificationSeverity,
          title: 'Project Group Formed',
          message: `${params.projectGroupName} was approved and is now an active project group.`,
          metadata: {
            departmentId: params.departmentId,
            projectGroupId: params.projectGroupId,
            projectGroupName: params.projectGroupName,
            reviewerUserId: params.reviewerUserId,
          },
          idempotencyKey,
        });
      })
    );

    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    if (rejected.length > 0) {
      const reasons = rejected
        .map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason)))
        .slice(0, 5)
        .join(' | ');

      this.logger.warn(
        `ProjectGroupFormed notifications: ${rejected.length}/${results.length} failed (${reasons})`
      );
    }
  }

  async notifyProjectGroupMeetingScheduled(params: {
    tenantId: string;
    userIds: string[];
    departmentId: string;
    projectId: string;
    projectGroupId: string;
    projectGroupName?: string;
    meetingId: string;
    title: string;
    meetingAt: Date;
    durationMinutes: number;
    agenda: string;
    createdByUserId?: string;
  }): Promise<void> {
    const uniqueUserIds = Array.from(new Set((params.userIds ?? []).filter(Boolean)));
    if (!uniqueUserIds.length) return;

    const meetingAtIso = params.meetingAt.toISOString();

    const results = await Promise.allSettled(
      uniqueUserIds.map((userId) => {
        const idempotencyKey = `project_group_meeting_scheduled:${params.meetingId}:${userId}`;
        return this.createNotification({
          tenantId: params.tenantId,
          userId,
          eventType:
            NOTIFICATION_EVENT_TYPES.PROJECT_GROUP_MEETING_SCHEDULED as unknown as NotificationEventType,
          severity: NOTIFICATION_SEVERITIES.INFO as NotificationSeverity,
          title: 'Meeting Scheduled',
          message: params.projectGroupName
            ? `A meeting \"${params.title}\" was scheduled for ${params.projectGroupName}.`
            : `A meeting \"${params.title}\" was scheduled for your project group.`,
          metadata: {
            departmentId: params.departmentId,
            projectId: params.projectId,
            projectGroupId: params.projectGroupId,
            projectGroupName: params.projectGroupName,
            meetingId: params.meetingId,
            meetingTitle: params.title,
            meetingAt: meetingAtIso,
            durationMinutes: params.durationMinutes,
            agenda: params.agenda,
            createdByUserId: params.createdByUserId,
          },
          idempotencyKey,
        });
      })
    );

    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    if (rejected.length > 0) {
      const reasons = rejected
        .map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason)))
        .slice(0, 5)
        .join(' | ');

      this.logger.warn(
        `ProjectGroupMeetingScheduled notifications: ${rejected.length}/${results.length} failed (${reasons})`
      );
    }
  }

  async notifyProjectGroupMeetingUpdated(params: {
    tenantId: string;
    userIds: string[];
    departmentId: string;
    projectId: string;
    projectGroupId: string;
    meetingId: string;
    title: string;
    meetingAt: Date;
    durationMinutes: number;
    agenda: string;
    updatedByUserId?: string;
  }): Promise<void> {
    const uniqueUserIds = Array.from(new Set((params.userIds ?? []).filter(Boolean)));
    if (!uniqueUserIds.length) return;

    const meetingAtIso = params.meetingAt.toISOString();

    const results = await Promise.allSettled(
      uniqueUserIds.map((userId) => {
        const idempotencyKey = `project_group_meeting_updated:${params.meetingId}:${userId}:${meetingAtIso}`;
        return this.createNotification({
          tenantId: params.tenantId,
          userId,
          eventType:
            NOTIFICATION_EVENT_TYPES.PROJECT_GROUP_MEETING_UPDATED as unknown as NotificationEventType,
          severity: NOTIFICATION_SEVERITIES.INFO as NotificationSeverity,
          title: 'Meeting Updated',
          message: `Meeting \"${params.title}\" was updated.`,
          metadata: {
            departmentId: params.departmentId,
            projectId: params.projectId,
            projectGroupId: params.projectGroupId,
            meetingId: params.meetingId,
            meetingTitle: params.title,
            meetingAt: meetingAtIso,
            durationMinutes: params.durationMinutes,
            agenda: params.agenda,
            updatedByUserId: params.updatedByUserId,
          },
          idempotencyKey,
        });
      })
    );

    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    if (rejected.length > 0) {
      const reasons = rejected
        .map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason)))
        .slice(0, 5)
        .join(' | ');

      this.logger.warn(
        `ProjectGroupMeetingUpdated notifications: ${rejected.length}/${results.length} failed (${reasons})`
      );
    }
  }

  async notifyProjectGroupMeetingCancelled(params: {
    tenantId: string;
    userIds: string[];
    departmentId: string;
    projectId: string;
    projectGroupId: string;
    meetingId: string;
    title: string;
    meetingAt: Date;
    cancellationReason?: string;
    cancelledByUserId?: string;
  }): Promise<void> {
    const uniqueUserIds = Array.from(new Set((params.userIds ?? []).filter(Boolean)));
    if (!uniqueUserIds.length) return;

    const meetingAtIso = params.meetingAt.toISOString();

    const results = await Promise.allSettled(
      uniqueUserIds.map((userId) => {
        const idempotencyKey = `project_group_meeting_cancelled:${params.meetingId}:${userId}`;
        return this.createNotification({
          tenantId: params.tenantId,
          userId,
          eventType:
            NOTIFICATION_EVENT_TYPES.PROJECT_GROUP_MEETING_CANCELLED as unknown as NotificationEventType,
          severity: NOTIFICATION_SEVERITIES.HIGH as NotificationSeverity,
          title: 'Meeting Cancelled',
          message: `Meeting \"${params.title}\" has been cancelled.`,
          metadata: {
            departmentId: params.departmentId,
            projectId: params.projectId,
            projectGroupId: params.projectGroupId,
            meetingId: params.meetingId,
            meetingTitle: params.title,
            meetingAt: meetingAtIso,
            cancellationReason: params.cancellationReason,
            cancelledByUserId: params.cancelledByUserId,
          },
          idempotencyKey,
        });
      })
    );

    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    if (rejected.length > 0) {
      const reasons = rejected
        .map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason)))
        .slice(0, 5)
        .join(' | ');

      this.logger.warn(
        `ProjectGroupMeetingCancelled notifications: ${rejected.length}/${results.length} failed (${reasons})`
      );
    }
  }

  async notifyMilestoneCompleted(params: {
    tenantId: string;
    userIds: string[];
    departmentId: string;
    projectId: string;
    projectTitle?: string;
    milestoneId: string;
    milestoneTitle: string;
    projectGroupId?: string;
    projectGroupName?: string;
    actorUserId?: string;
  }): Promise<void> {
    const uniqueUserIds = Array.from(new Set((params.userIds ?? []).filter(Boolean)));
    if (!uniqueUserIds.length) return;

    const subject = params.projectGroupName?.trim() || params.projectTitle?.trim() || 'Project team';

    const results = await Promise.allSettled(
      uniqueUserIds.map((userId) => {
        const idempotencyKey = `milestone_completed:${params.milestoneId}:${userId}`;
        return this.createNotification({
          tenantId: params.tenantId,
          userId,
          eventType:
            NOTIFICATION_EVENT_TYPES.MILESTONE_COMPLETED as unknown as NotificationEventType,
          severity: NOTIFICATION_SEVERITIES.INFO as NotificationSeverity,
          title: 'Milestone Completed',
          message: `${subject} completed ${params.milestoneTitle}.`,
          metadata: {
            departmentId: params.departmentId,
            projectId: params.projectId,
            projectTitle: params.projectTitle,
            milestoneId: params.milestoneId,
            milestoneTitle: params.milestoneTitle,
            projectGroupId: params.projectGroupId,
            projectGroupName: params.projectGroupName,
            actorUserId: params.actorUserId,
          },
          idempotencyKey,
        });
      })
    );

    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    if (rejected.length > 0) {
      const reasons = rejected
        .map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason)))
        .slice(0, 5)
        .join(' | ');

      this.logger.warn(
        `MilestoneCompleted notifications: ${rejected.length}/${results.length} failed (${reasons})`
      );
    }
  }

  async notifyMilestoneFeedbackAdded(params: {
    tenantId: string;
    userIds: string[];
    departmentId: string;
    projectId: string;
    projectTitle?: string;
    milestoneId: string;
    milestoneTitle: string;
    submissionId: string;
    actorUserId: string;
    actorRole: string;
    projectGroupId?: string;
    projectGroupName?: string;
    messagePreview?: string;
    hasAttachment?: boolean;
  }): Promise<void> {
    const uniqueUserIds = Array.from(new Set((params.userIds ?? []).filter(Boolean)));
    if (!uniqueUserIds.length) return;

    const subject = params.projectGroupName?.trim() || params.projectTitle?.trim() || 'Project team';
    const preview = (params.messagePreview ?? '').trim();
    const attachmentSuffix = params.hasAttachment ? ' An attachment was included.' : '';
    const message = preview
      ? `${subject}: new milestone feedback on ${params.milestoneTitle}. ${preview}${attachmentSuffix}`
      : `${subject}: new milestone feedback was added to ${params.milestoneTitle}.${attachmentSuffix}`;

    const results = await Promise.allSettled(
      uniqueUserIds.map((userId) => {
        const idempotencyKey = `milestone_feedback_added:${params.submissionId}:${params.actorUserId}:${userId}`;
        return this.createNotification({
          tenantId: params.tenantId,
          userId,
          eventType:
            NOTIFICATION_EVENT_TYPES.MILESTONE_FEEDBACK_ADDED as unknown as NotificationEventType,
          severity: NOTIFICATION_SEVERITIES.INFO as NotificationSeverity,
          title: 'Milestone Feedback Added',
          message,
          metadata: {
            departmentId: params.departmentId,
            projectId: params.projectId,
            projectTitle: params.projectTitle,
            milestoneId: params.milestoneId,
            milestoneTitle: params.milestoneTitle,
            submissionId: params.submissionId,
            actorUserId: params.actorUserId,
            actorRole: params.actorRole,
            projectGroupId: params.projectGroupId,
            projectGroupName: params.projectGroupName,
            messagePreview: preview || undefined,
            hasAttachment: params.hasAttachment === true,
          },
          idempotencyKey,
        });
      })
    );

    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    if (rejected.length > 0) {
      const reasons = rejected
        .map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason)))
        .slice(0, 5)
        .join(' | ');

      this.logger.warn(
        `MilestoneFeedbackAdded notifications: ${rejected.length}/${results.length} failed (${reasons})`
      );
    }
  }

  async notifyMilestoneApproved(params: {
    tenantId: string;
    userIds: string[];
    departmentId: string;
    projectId: string;
    projectTitle?: string;
    milestoneId: string;
    milestoneTitle: string;
    submissionId: string;
    actorUserId?: string;
    projectGroupId?: string;
    projectGroupName?: string;
  }): Promise<void> {
    const uniqueUserIds = Array.from(new Set((params.userIds ?? []).filter(Boolean)));
    if (!uniqueUserIds.length) return;

    const subject = params.projectGroupName?.trim() || params.projectTitle?.trim() || 'Project team';

    const results = await Promise.allSettled(
      uniqueUserIds.map((userId) => {
        const idempotencyKey = `milestone_approved:${params.submissionId}:${userId}`;
        return this.createNotification({
          tenantId: params.tenantId,
          userId,
          eventType:
            NOTIFICATION_EVENT_TYPES.MILESTONE_APPROVED as unknown as NotificationEventType,
          severity: NOTIFICATION_SEVERITIES.INFO as NotificationSeverity,
          title: 'Milestone Approved',
          message: `${subject}: ${params.milestoneTitle} was approved by the advisor.`,
          metadata: {
            departmentId: params.departmentId,
            projectId: params.projectId,
            projectTitle: params.projectTitle,
            milestoneId: params.milestoneId,
            milestoneTitle: params.milestoneTitle,
            submissionId: params.submissionId,
            actorUserId: params.actorUserId,
            projectGroupId: params.projectGroupId,
            projectGroupName: params.projectGroupName,
          },
          idempotencyKey,
        });
      })
    );

    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    if (rejected.length > 0) {
      const reasons = rejected
        .map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason)))
        .slice(0, 5)
        .join(' | ');

      this.logger.warn(
        `MilestoneApproved notifications: ${rejected.length}/${results.length} failed (${reasons})`
      );
    }
  }

  async notifyDepartmentDocumentTemplateCreated(params: {
    tenantId: string;
    userIds: string[];
    departmentId: string;
    departmentName?: string;
    templateId: string;
    templateTitle: string;
    templateType: string;
    fileCount: number;
    actorUserId?: string;
  }): Promise<void> {
    const uniqueUserIds = Array.from(new Set((params.userIds ?? []).filter(Boolean)));
    if (uniqueUserIds.length === 0) return;

    const results = await Promise.allSettled(
      uniqueUserIds.map((userId) => {
        const idempotencyKey = `department_document_template_created:${params.templateId}:${userId}`;
        return this.createNotification({
          tenantId: params.tenantId,
          userId,
          eventType:
            NOTIFICATION_EVENT_TYPES.DEPARTMENT_DOCUMENT_TEMPLATE_CREATED as NotificationEventType,
          severity: NOTIFICATION_SEVERITIES.INFO as NotificationSeverity,
          title: params.departmentName
            ? `New Document Template (${params.departmentName})`
            : 'New Document Template',
          message: `A new document template "${params.templateTitle}" (${params.templateType}) was created with ${params.fileCount} file(s).`,
          metadata: {
            departmentId: params.departmentId,
            departmentName: params.departmentName,
            templateId: params.templateId,
            templateTitle: params.templateTitle,
            templateType: params.templateType,
            fileCount: params.fileCount,
            actorUserId: params.actorUserId,
          },
          idempotencyKey,
        });
      })
    );

    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    if (rejected.length > 0) {
      const reasons = rejected
        .map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason)))
        .slice(0, 5)
        .join(' | ');

      this.logger.warn(
        `DepartmentDocumentTemplateCreated notifications: ${rejected.length}/${results.length} failed (${reasons})`
      );
    }
  }

  async notifyDepartmentDocumentTemplateUpdated(params: {
    tenantId: string;
    userIds: string[];
    departmentId: string;
    departmentName?: string;
    templateId: string;
    templateTitle: string;
    templateType: string;
    actorUserId?: string;
  }): Promise<void> {
    const uniqueUserIds = Array.from(new Set((params.userIds ?? []).filter(Boolean)));
    if (uniqueUserIds.length === 0) return;

    const results = await Promise.allSettled(
      uniqueUserIds.map((userId) => {
        const idempotencyKey = `department_document_template_updated:${params.templateId}:${userId}`;
        return this.createNotification({
          tenantId: params.tenantId,
          userId,
          eventType:
            NOTIFICATION_EVENT_TYPES.DEPARTMENT_DOCUMENT_TEMPLATE_UPDATED as NotificationEventType,
          severity: NOTIFICATION_SEVERITIES.INFO as NotificationSeverity,
          title: params.departmentName
            ? `Document Template Updated (${params.departmentName})`
            : 'Document Template Updated',
          message: `The document template "${params.templateTitle}" (${params.templateType}) was updated.`,
          metadata: {
            departmentId: params.departmentId,
            departmentName: params.departmentName,
            templateId: params.templateId,
            templateTitle: params.templateTitle,
            templateType: params.templateType,
            actorUserId: params.actorUserId,
          },
          idempotencyKey,
        });
      })
    );

    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    if (rejected.length > 0) {
      const reasons = rejected
        .map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason)))
        .slice(0, 5)
        .join(' | ');

      this.logger.warn(
        `DepartmentDocumentTemplateUpdated notifications: ${rejected.length}/${results.length} failed (${reasons})`
      );
    }
  }

  async notifyDepartmentDocumentTemplateDeleted(params: {
    tenantId: string;
    userIds: string[];
    departmentId: string;
    departmentName?: string;
    templateId: string;
    templateTitle: string;
    templateType: string;
    actorUserId?: string;
  }): Promise<void> {
    const uniqueUserIds = Array.from(new Set((params.userIds ?? []).filter(Boolean)));
    if (uniqueUserIds.length === 0) return;

    const results = await Promise.allSettled(
      uniqueUserIds.map((userId) => {
        const idempotencyKey = `department_document_template_deleted:${params.templateId}:${userId}`;
        return this.createNotification({
          tenantId: params.tenantId,
          userId,
          eventType:
            NOTIFICATION_EVENT_TYPES.DEPARTMENT_DOCUMENT_TEMPLATE_DELETED as NotificationEventType,
          severity: NOTIFICATION_SEVERITIES.INFO as NotificationSeverity,
          title: params.departmentName
            ? `Document Template Deleted (${params.departmentName})`
            : 'Document Template Deleted',
          message: `The document template "${params.templateTitle}" (${params.templateType}) was deleted.`,
          metadata: {
            departmentId: params.departmentId,
            departmentName: params.departmentName,
            templateId: params.templateId,
            templateTitle: params.templateTitle,
            templateType: params.templateType,
            actorUserId: params.actorUserId,
          },
          idempotencyKey,
        });
      })
    );

    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    if (rejected.length > 0) {
      const reasons = rejected
        .map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason)))
        .slice(0, 5)
        .join(' | ');

      this.logger.warn(
        `DepartmentDocumentTemplateDeleted notifications: ${rejected.length}/${results.length} failed (${reasons})`
      );
    }
  }

  // Helper methods for specific events
  async notifyPasswordResetRequested(
    tenantId: string,
    userId: string,
    metadata?: { ipHash?: string; deviceFingerprintHash?: string; locationApprox?: string }
  ) {
    const idempotencyKey = `reset_requested:${userId}:${Date.now()}`;
    return this.createNotification({
      tenantId,
      userId,
      eventType:
        NOTIFICATION_EVENT_TYPES.SECURITY_PASSWORD_RESET_REQUESTED as NotificationEventType,
      severity: NOTIFICATION_SEVERITIES.HIGH as NotificationSeverity,
      title: 'Password Reset Requested',
      message:
        'A password reset was initiated for your account. If this was not you, please contact support immediately.',
      metadata,
      idempotencyKey,
    });
  }

  async notifyPasswordResetSuccess(
    tenantId: string,
    userId: string,
    metadata?: { ipHash?: string; deviceFingerprintHash?: string; locationApprox?: string }
  ) {
    const idempotencyKey = `reset_success:${userId}:${Date.now()}`;
    return this.createNotification({
      tenantId,
      userId,
      eventType: NOTIFICATION_EVENT_TYPES.SECURITY_PASSWORD_RESET_SUCCESS as NotificationEventType,
      severity: NOTIFICATION_SEVERITIES.HIGH as NotificationSeverity,
      title: 'Password Changed Successfully',
      message: 'Your password has been successfully changed.',
      metadata,
      idempotencyKey,
    });
  }

  async notifyPasswordChanged(
    tenantId: string,
    userId: string,
    metadata?: { ipHash?: string; deviceFingerprintHash?: string; locationApprox?: string }
  ) {
    const idempotencyKey = `password_changed:${userId}:${Date.now()}`;
    return this.createNotification({
      tenantId,
      userId,
      eventType: NOTIFICATION_EVENT_TYPES.SECURITY_PASSWORD_CHANGED as NotificationEventType,
      severity: NOTIFICATION_SEVERITIES.HIGH as NotificationSeverity,
      title: 'Password Changed',
      message:
        'Your password has been changed. If you did not make this change, please contact support immediately.',
      metadata,
      idempotencyKey,
    });
  }

  async notifySuspiciousResetActivity(
    tenantId: string,
    userId: string,
    metadata?: { attemptCount?: number; ipHash?: string; deviceFingerprintHash?: string }
  ) {
    const idempotencyKey = `suspicious_reset:${userId}:${Date.now()}`;
    return this.createNotification({
      tenantId,
      userId,
      eventType:
        NOTIFICATION_EVENT_TYPES.SECURITY_SUSPICIOUS_RESET_ACTIVITY as NotificationEventType,
      severity: NOTIFICATION_SEVERITIES.CRITICAL as NotificationSeverity,
      title: 'Suspicious Activity Detected',
      message: 'Multiple password reset attempts detected. Please review your account security.',
      metadata,
      idempotencyKey,
    });
  }

  async notifyAccountLocked(
    tenantId: string,
    userId: string,
    metadata?: { failedAttempts?: number; lockDuration?: string }
  ) {
    const idempotencyKey = `account_locked:${userId}:${Date.now()}`;
    return this.createNotification({
      tenantId,
      userId,
      eventType: NOTIFICATION_EVENT_TYPES.SYSTEM_ACCOUNT_LOCKED as NotificationEventType,
      severity: NOTIFICATION_SEVERITIES.HIGH as NotificationSeverity,
      title: 'Account Temporarily Locked',
      message: 'Your account has been locked due to multiple failed login attempts.',
      metadata,
      idempotencyKey,
    });
  }

  async notifyProfileNameChanged(
    tenantId: string,
    userId: string,
    metadata?: { oldName?: string; newName?: string }
  ) {
    const idempotencyKey = `profile_name_changed:${userId}:${Date.now()}`;
    return this.createNotification({
      tenantId,
      userId,
      eventType: NOTIFICATION_EVENT_TYPES.PROFILE_NAME_CHANGED as NotificationEventType,
      severity: NOTIFICATION_SEVERITIES.INFO as NotificationSeverity,
      title: 'Profile Name Updated',
      message: 'Your profile name has been successfully updated.',
      metadata,
      idempotencyKey,
    });
  }

  async notifyProfileAvatarUpdated(
    tenantId: string,
    userId: string,
    metadata?: { avatarUrl?: string }
  ) {
    const idempotencyKey = `profile_avatar_updated:${userId}:${Date.now()}`;
    return this.createNotification({
      tenantId,
      userId,
      eventType: NOTIFICATION_EVENT_TYPES.PROFILE_AVATAR_UPDATED as NotificationEventType,
      severity: NOTIFICATION_SEVERITIES.INFO as NotificationSeverity,
      title: 'Profile Picture Updated',
      message: 'Your profile picture has been successfully updated.',
      metadata,
      idempotencyKey,
    });
  }

  async notifyInstitutionVerificationSubmitted(params: {
    tenantId: string;
    userId: string;
    requestId: string;
    tenantName?: string;
  }) {
    const idempotencyKey = `institution_verification_submitted:${params.requestId}`;
    return this.createNotification({
      tenantId: params.tenantId,
      userId: params.userId,
      eventType:
        NOTIFICATION_EVENT_TYPES.INSTITUTION_VERIFICATION_SUBMITTED as NotificationEventType,
      severity: NOTIFICATION_SEVERITIES.INFO as NotificationSeverity,
      title: 'Verification Submitted',
      message: `Your institution verification document has been submitted and is pending review.`,
      metadata: { requestId: params.requestId, tenantName: params.tenantName },
      idempotencyKey,
    });
  }

  async notifyInstitutionAddressUpdated(params: {
    tenantId: string;
    userId: string;
    tenantName?: string;
    address?: {
      country?: string;
      city?: string;
      region?: string;
      street?: string;
      phone?: string;
      website?: string;
    };
    isFirstSet?: boolean;
  }) {
    const idempotencyKey = params.isFirstSet
      ? `institution_address_set:${params.tenantId}`
      : `institution_address_updated:${params.tenantId}:${Date.now()}`;

    return this.createNotification({
      tenantId: params.tenantId,
      userId: params.userId,
      eventType: NOTIFICATION_EVENT_TYPES.INSTITUTION_ADDRESS_UPDATED as NotificationEventType,
      severity: NOTIFICATION_SEVERITIES.INFO as NotificationSeverity,
      title: params.isFirstSet ? 'Institution Address Added' : 'Institution Address Updated',
      message: params.isFirstSet
        ? 'Your institution address/contact details have been saved.'
        : 'Your institution address/contact details have been updated.',
      metadata: {
        tenantName: params.tenantName,
        address: params.address,
        isFirstSet: params.isFirstSet === true,
      },
      idempotencyKey,
    });
  }

  async notifyInstitutionLogoUpdated(params: {
    tenantId: string;
    userId: string;
    tenantName?: string;
    logoUrl?: string;
    isFirstSet?: boolean;
  }) {
    const idempotencyKey = params.isFirstSet
      ? `institution_logo_set:${params.tenantId}`
      : `institution_logo_updated:${params.tenantId}:${Date.now()}`;

    return this.createNotification({
      tenantId: params.tenantId,
      userId: params.userId,
      eventType: NOTIFICATION_EVENT_TYPES.INSTITUTION_LOGO_UPDATED as NotificationEventType,
      severity: NOTIFICATION_SEVERITIES.INFO as NotificationSeverity,
      title: params.isFirstSet ? 'Institution Logo Added' : 'Institution Logo Updated',
      message: params.isFirstSet
        ? 'Your institution logo has been saved.'
        : 'Your institution logo has been updated.',
      metadata: {
        tenantName: params.tenantName,
        logoUrl: params.logoUrl,
        isFirstSet: params.isFirstSet === true,
      },
      idempotencyKey,
    });
  }

  async notifyPlatformAdminsInstitutionVerificationSubmitted(params: {
    requestId: string;
    tenantId: string;
    tenantName?: string;
    tenantDomain?: string;
    submittedByEmail?: string;
    submittedByName?: string;
    documentUrl?: string;
  }): Promise<void> {
    const systemTenant = await this.prisma.tenant.findUnique({
      where: { domain: 'system' },
      select: { id: true },
    });

    if (!systemTenant) {
      this.logger.warn('System tenant not found; skipping PlatformAdmin notification');
      return;
    }

    const admins = await this.prisma.user.findMany({
      where: {
        tenantId: systemTenant.id,
        status: UserStatus.ACTIVE,
        roles: {
          some: {
            revokedAt: null,
            role: {
              name: ROLES.PLATFORM_ADMIN,
            },
          },
        },
      },
      select: { id: true },
    });

    if (admins.length === 0) return;

    const adminPath = `/admin/tenant-verification/requests/${params.requestId}`;

    const tenantName = params.tenantName ?? 'Institution';
    const submittedBy = params.submittedByName
      ? `${params.submittedByName}${params.submittedByEmail ? ` (${params.submittedByEmail})` : ''}`
      : params.submittedByEmail
        ? params.submittedByEmail
        : 'A Department Head';

    await Promise.allSettled(
      admins.map((admin) => {
        const idempotencyKey = `institution_verification_submitted_admin:${params.requestId}:${admin.id}`;
        return this.createNotification({
          tenantId: systemTenant.id,
          userId: admin.id,
          eventType:
            NOTIFICATION_EVENT_TYPES.INSTITUTION_VERIFICATION_SUBMITTED as NotificationEventType,
          severity: NOTIFICATION_SEVERITIES.INFO as NotificationSeverity,
          title: 'New Verification Submission',
          message: `${submittedBy} submitted an institution verification document for ${tenantName}.`,
          metadata: {
            requestId: params.requestId,
            tenantId: params.tenantId,
            tenantName: params.tenantName,
            tenantDomain: params.tenantDomain,
            submittedByEmail: params.submittedByEmail,
            submittedByName: params.submittedByName,
            documentUrl: params.documentUrl,
            adminPath,
          },
          idempotencyKey,
        });
      })
    );
  }

  async notifyInstitutionVerificationApproved(params: {
    tenantId: string;
    userId: string;
    requestId: string;
    tenantName?: string;
    reason?: string | null;
  }) {
    const idempotencyKey = `institution_verification_approved:${params.requestId}`;
    return this.createNotification({
      tenantId: params.tenantId,
      userId: params.userId,
      eventType:
        NOTIFICATION_EVENT_TYPES.INSTITUTION_VERIFICATION_APPROVED as NotificationEventType,
      severity: NOTIFICATION_SEVERITIES.INFO as NotificationSeverity,
      title: 'Verification Approved',
      message: `Your institution verification has been approved.`,
      metadata: {
        requestId: params.requestId,
        tenantName: params.tenantName,
        reason: params.reason ?? undefined,
      },
      idempotencyKey,
    });
  }

  async notifyInstitutionVerificationRejected(params: {
    tenantId: string;
    userId: string;
    requestId: string;
    tenantName?: string;
    reason: string;
  }) {
    const idempotencyKey = `institution_verification_rejected:${params.requestId}`;
    return this.createNotification({
      tenantId: params.tenantId,
      userId: params.userId,
      eventType:
        NOTIFICATION_EVENT_TYPES.INSTITUTION_VERIFICATION_REJECTED as NotificationEventType,
      severity: NOTIFICATION_SEVERITIES.HIGH as NotificationSeverity,
      title: 'Verification Rejected',
      message: `Your institution verification was rejected. Please review the reason and resubmit.`,
      metadata: {
        requestId: params.requestId,
        tenantName: params.tenantName,
        reason: params.reason,
      },
      idempotencyKey,
    });
  }

  async notifyProposalSubmitted(params: {
    tenantId: string;
    proposalId: string;
    submitterUserId: string;
    reviewerUserIds: string[];
    projectGroupId?: string;
  }) {
    const reviewerUserIds = Array.from(new Set((params.reviewerUserIds ?? []).filter(Boolean)));
    if (!reviewerUserIds.length) return;

    const results = await Promise.allSettled(
      reviewerUserIds.map((reviewerUserId) => {
        const idempotencyKey = `proposal_submitted:${params.proposalId}:${reviewerUserId}`;
        return this.createNotification({
          tenantId: params.tenantId,
          userId: reviewerUserId,
          eventType: NOTIFICATION_EVENT_TYPES.PROPOSAL_SUBMITTED as NotificationEventType,
          severity: NOTIFICATION_SEVERITIES.INFO as NotificationSeverity,
          title: 'New Proposal Submitted',
          message: 'A new project proposal was submitted and is awaiting review.',
          metadata: {
            proposalId: params.proposalId,
            submitterUserId: params.submitterUserId,
            projectGroupId: params.projectGroupId,
          },
          idempotencyKey,
        });
      })
    );

    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    if (rejected.length > 0) {
      const reasons = rejected
        .map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason)))
        .slice(0, 5)
        .join(' | ');

      this.logger.warn(
        `ProposalSubmitted notifications: ${rejected.length}/${results.length} failed (${reasons})`
      );
    }
  }

  async notifyProposalApproved(params: {
    tenantId: string;
    proposalId: string;
    recipientUserIds: string[];
    reviewerUserId: string;
    advisorId?: string;
    projectGroupId?: string;
  }) {
    const recipientUserIds = Array.from(new Set((params.recipientUserIds ?? []).filter(Boolean)));
    if (!recipientUserIds.length) return;

    const results = await Promise.allSettled(
      recipientUserIds.map((recipientUserId) => {
        const idempotencyKey = `proposal_approved:${params.proposalId}:${recipientUserId}`;
        return this.createNotification({
          tenantId: params.tenantId,
          userId: recipientUserId,
          eventType: NOTIFICATION_EVENT_TYPES.PROPOSAL_APPROVED as NotificationEventType,
          severity: NOTIFICATION_SEVERITIES.INFO as NotificationSeverity,
          title: 'Proposal Approved',
          message: 'Your project proposal was approved.',
          metadata: {
            proposalId: params.proposalId,
            reviewerUserId: params.reviewerUserId,
            advisorId: params.advisorId,
            projectGroupId: params.projectGroupId,
          },
          idempotencyKey,
        });
      })
    );

    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    if (rejected.length > 0) {
      const reasons = rejected
        .map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason)))
        .slice(0, 5)
        .join(' | ');

      this.logger.warn(
        `ProposalApproved notifications: ${rejected.length}/${results.length} failed (${reasons})`
      );
    }
  }

  async notifyProposalRejected(params: {
    tenantId: string;
    proposalId: string;
    recipientUserIds: string[];
    reviewerUserId: string;
    rejectionReason?: string;
    projectGroupId?: string;
  }) {
    const recipientUserIds = Array.from(new Set((params.recipientUserIds ?? []).filter(Boolean)));
    if (!recipientUserIds.length) return;

    const results = await Promise.allSettled(
      recipientUserIds.map((recipientUserId) => {
        const idempotencyKey = `proposal_rejected:${params.proposalId}:${recipientUserId}`;
        return this.createNotification({
          tenantId: params.tenantId,
          userId: recipientUserId,
          eventType: NOTIFICATION_EVENT_TYPES.PROPOSAL_REJECTED as NotificationEventType,
          severity: NOTIFICATION_SEVERITIES.HIGH as NotificationSeverity,
          title: 'Proposal Rejected',
          message: 'Your project proposal was rejected. Please review feedback and resubmit.',
          metadata: {
            proposalId: params.proposalId,
            reviewerUserId: params.reviewerUserId,
            rejectionReason: params.rejectionReason,
            projectGroupId: params.projectGroupId,
          },
          idempotencyKey,
        });
      })
    );

    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    if (rejected.length > 0) {
      const reasons = rejected
        .map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason)))
        .slice(0, 5)
        .join(' | ');

      this.logger.warn(
        `ProposalRejected notifications: ${rejected.length}/${results.length} failed (${reasons})`
      );
    }
  }

  async notifyProposalFeedbackAdded(params: {
    tenantId: string;
    proposalId: string;
    recipientUserIds: string[];
    authorUserId: string;
    authorRole: string;
    messagePreview?: string;
  }) {
    const recipientUserIds = Array.from(new Set((params.recipientUserIds ?? []).filter(Boolean)));
    if (!recipientUserIds.length) return;

    const preview = (params.messagePreview ?? '').trim();
    const message = preview ? `New feedback: ${preview}` : 'New feedback was added to your proposal.';

    const results = await Promise.allSettled(
      recipientUserIds.map((recipientUserId) => {
        const idempotencyKey = `proposal_feedback_added:${params.proposalId}:${params.authorUserId}:${recipientUserId}`;
        return this.createNotification({
          tenantId: params.tenantId,
          userId: recipientUserId,
          eventType:
            NOTIFICATION_EVENT_TYPES.PROPOSAL_FEEDBACK_ADDED as unknown as NotificationEventType,
          severity: NOTIFICATION_SEVERITIES.INFO as NotificationSeverity,
          title: 'Proposal Feedback Added',
          message,
          metadata: {
            proposalId: params.proposalId,
            authorUserId: params.authorUserId,
            authorRole: params.authorRole,
            messagePreview: preview || undefined,
          },
          idempotencyKey,
        });
      })
    );

    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    if (rejected.length > 0) {
      const reasons = rejected
        .map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason)))
        .slice(0, 5)
        .join(' | ');
      this.logger.warn(
        `ProposalFeedbackAdded notifications: ${rejected.length}/${results.length} failed (${reasons})`
      );
    }
  }

  async notifyProposalResubmissionReminderCreated(params: {
    tenantId: string;
    proposalId: string;
    reminderId: string;
    recipientUserIds: string[];
    actorUserId: string;
    deadlineAt?: Date | string | null;
    projectGroupId?: string;
  }) {
    const recipientUserIds = Array.from(new Set((params.recipientUserIds ?? []).filter(Boolean)));
    if (!recipientUserIds.length) return;

    const results = await Promise.allSettled(
      recipientUserIds.map((recipientUserId) => {
        const idempotencyKey = `proposal_resubmission_reminder_created:${params.reminderId}:${recipientUserId}`;
        return this.createNotification({
          tenantId: params.tenantId,
          userId: recipientUserId,
          eventType:
            NOTIFICATION_EVENT_TYPES.PROPOSAL_RESUBMISSION_REMINDER_CREATED as unknown as NotificationEventType,
          severity: NOTIFICATION_SEVERITIES.HIGH as NotificationSeverity,
          title: 'Proposal Resubmission Reminder',
          message: 'Your group has a deadline to revise and resubmit the rejected proposal.',
          metadata: {
            proposalId: params.proposalId,
            reminderId: params.reminderId,
            actorUserId: params.actorUserId,
            deadlineAt: params.deadlineAt ?? undefined,
            projectGroupId: params.projectGroupId,
          },
          idempotencyKey,
        });
      })
    );

    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    if (rejected.length > 0) {
      const reasons = rejected
        .map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason)))
        .slice(0, 5)
        .join(' | ');
      this.logger.warn(
        `ProposalResubmissionReminderCreated notifications: ${rejected.length}/${results.length} failed (${reasons})`
      );
    }
  }

  async notifyProjectAdvisorAssigned(params: {
    tenantId: string;
    projectId: string;
    advisorUserId: string;
    recipientUserIds: string[];
    actorUserId?: string;
  }) {
    const recipientUserIds = Array.from(new Set((params.recipientUserIds ?? []).filter(Boolean)));
    if (!recipientUserIds.length) return;

    const results = await Promise.allSettled(
      recipientUserIds.map((recipientUserId) => {
        const idempotencyKey = `project_advisor_assigned:${params.projectId}:${params.advisorUserId}:${recipientUserId}`;
        return this.createNotification({
          tenantId: params.tenantId,
          userId: recipientUserId,
          eventType:
            NOTIFICATION_EVENT_TYPES.PROJECT_ADVISOR_ASSIGNED as unknown as NotificationEventType,
          severity: NOTIFICATION_SEVERITIES.INFO as NotificationSeverity,
          title: 'Advisor Assigned',
          message: 'An advisor has been assigned to your project.',
          metadata: {
            projectId: params.projectId,
            advisorUserId: params.advisorUserId,
            actorUserId: params.actorUserId,
          },
          idempotencyKey,
        });
      })
    );

    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    if (rejected.length > 0) {
      const reasons = rejected
        .map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason)))
        .slice(0, 5)
        .join(' | ');
      this.logger.warn(
        `ProjectAdvisorAssigned notifications: ${rejected.length}/${results.length} failed (${reasons})`
      );
    }
  }

  async notifyProjectEvaluatorsAssigned(params: {
    tenantId: string;
    projectId: string;
    evaluatorUserIds: string[];
    actorUserId: string;
  }) {
    if (!params.actorUserId) return;
    const evaluatorUserIds = Array.from(new Set((params.evaluatorUserIds ?? []).filter(Boolean)));
    if (!evaluatorUserIds.length) return;

    await this.createNotification({
      tenantId: params.tenantId,
      userId: params.actorUserId,
      eventType:
        NOTIFICATION_EVENT_TYPES.PROJECT_EVALUATORS_ASSIGNED as unknown as NotificationEventType,
      severity: NOTIFICATION_SEVERITIES.INFO as NotificationSeverity,
      title: 'Project Evaluators Assigned',
      message: 'Evaluator assignments were updated for the project.',
      metadata: {
        projectId: params.projectId,
        evaluatorUserIds,
        actorUserId: params.actorUserId,
      },
      idempotencyKey: `project_evaluators_assigned:${params.projectId}:${params.actorUserId}:${Date.now()}`,
    });
  }

  async notifyProjectEvaluatorRemoved(params: {
    tenantId: string;
    projectId: string;
    evaluatorUserId: string;
    actorUserId: string;
  }) {
    if (!params.actorUserId || !params.evaluatorUserId) return;

    await this.createNotification({
      tenantId: params.tenantId,
      userId: params.actorUserId,
      eventType: NOTIFICATION_EVENT_TYPES.PROJECT_EVALUATOR_REMOVED as unknown as NotificationEventType,
      severity: NOTIFICATION_SEVERITIES.INFO as NotificationSeverity,
      title: 'Project Evaluator Removed',
      message: 'An evaluator was removed from the project.',
      metadata: {
        projectId: params.projectId,
        evaluatorUserId: params.evaluatorUserId,
        actorUserId: params.actorUserId,
      },
      idempotencyKey: `project_evaluator_removed:${params.projectId}:${params.evaluatorUserId}:${params.actorUserId}:${Date.now()}`,
    });
  }
}
