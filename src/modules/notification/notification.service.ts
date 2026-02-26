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
    private readonly prisma: PrismaService
  ) {}

  async createNotification(data: CreateNotificationData) {
    const existing = await this.notificationRepository.findByIdempotencyKey(data.idempotencyKey);
    if (existing) {
      this.logger.warn(`Duplicate notification attempt for key: ${data.idempotencyKey}`);
      return existing;
    }

    const notification = await this.notificationRepository.createNotification(data);
    this.logger.log(`Created notification ${notification.id} for user ${data.userId}`);

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

    return notification;
  }

  async getUserNotifications(
    tenantId: string,
    userId: string,
    options?: { status?: NotificationStatus; limit?: number; offset?: number }
  ) {
    return this.notificationRepository.findNotificationsByUser(tenantId, userId, options);
  }

  async getUnreadCount(tenantId: string, userId: string): Promise<number> {
    return this.notificationRepository.countUnreadNotifications(tenantId, userId);
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
    status?: NotificationStatus
  ): Promise<number> {
    return this.notificationRepository.countNotificationsByUser(tenantId, userId, status);
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
}
