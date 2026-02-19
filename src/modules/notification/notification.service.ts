import { Injectable, Logger } from '@nestjs/common';
import { NotificationRepository } from './notification.repository';
import { NotificationGateway } from './notification.gateway';
import { NotificationEventType, NotificationSeverity, NotificationStatus } from '@prisma/client';
import { NOTIFICATION_EVENT_TYPES, NOTIFICATION_SEVERITIES } from '../../common/constants/notifications.constants';

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
    options?: { status?: NotificationStatus; limit?: number; offset?: number },
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
    status?: NotificationStatus,
  ): Promise<number> {
    return this.notificationRepository.countNotificationsByUser(tenantId, userId, status);
  }

  // Helper methods for specific events
  async notifyPasswordResetRequested(
    tenantId: string,
    userId: string,
    metadata?: { ipHash?: string; deviceFingerprintHash?: string; locationApprox?: string },
  ) {
    const idempotencyKey = `reset_requested:${userId}:${Date.now()}`;
    return this.createNotification({
      tenantId,
      userId,
      eventType: NOTIFICATION_EVENT_TYPES.SECURITY_PASSWORD_RESET_REQUESTED as NotificationEventType,
      severity: NOTIFICATION_SEVERITIES.HIGH as NotificationSeverity,
      title: 'Password Reset Requested',
      message: 'A password reset was initiated for your account. If this was not you, please contact support immediately.',
      metadata,
      idempotencyKey,
    });
  }

  async notifyPasswordResetSuccess(
    tenantId: string,
    userId: string,
    metadata?: { ipHash?: string; deviceFingerprintHash?: string; locationApprox?: string },
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
    metadata?: { ipHash?: string; deviceFingerprintHash?: string; locationApprox?: string },
  ) {
    const idempotencyKey = `password_changed:${userId}:${Date.now()}`;
    return this.createNotification({
      tenantId,
      userId,
      eventType: NOTIFICATION_EVENT_TYPES.SECURITY_PASSWORD_CHANGED as NotificationEventType,
      severity: NOTIFICATION_SEVERITIES.HIGH as NotificationSeverity,
      title: 'Password Changed',
      message: 'Your password has been changed. If you did not make this change, please contact support immediately.',
      metadata,
      idempotencyKey,
    });
  }

  async notifySuspiciousResetActivity(
    tenantId: string,
    userId: string,
    metadata?: { attemptCount?: number; ipHash?: string; deviceFingerprintHash?: string },
  ) {
    const idempotencyKey = `suspicious_reset:${userId}:${Date.now()}`;
    return this.createNotification({
      tenantId,
      userId,
      eventType: NOTIFICATION_EVENT_TYPES.SECURITY_SUSPICIOUS_RESET_ACTIVITY as NotificationEventType,
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
    metadata?: { failedAttempts?: number; lockDuration?: string },
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
    metadata?: { oldName?: string; newName?: string },
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
    metadata?: { avatarUrl?: string },
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
}