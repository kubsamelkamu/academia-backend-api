import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  Notification,
  NotificationEventType,
  NotificationSeverity,
  NotificationStatus,
} from '@prisma/client';

@Injectable()
export class NotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createNotification(data: {
    tenantId: string;
    userId: string;
    eventType: NotificationEventType;
    severity: NotificationSeverity;
    title: string;
    message: string;
    metadata?: any;
    idempotencyKey: string;
  }): Promise<Notification> {
    return this.prisma.notification.create({
      data,
    });
  }

  async findNotificationsByUser(
    tenantId: string,
    userId: string,
    options?: {
      status?: NotificationStatus;
      limit?: number;
      offset?: number;
    }
  ): Promise<Notification[]> {
    return this.prisma.notification.findMany({
      where: {
        tenantId,
        userId,
        ...(options?.status && { status: options.status }),
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 50,
      skip: options?.offset || 0,
    });
  }

  async countUnreadNotifications(tenantId: string, userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: {
        tenantId,
        userId,
        status: NotificationStatus.UNREAD,
      },
    });
  }

  async markAsRead(notificationId: string, userId: string): Promise<Notification | null> {
    return this.prisma.notification
      .updateMany({
        where: { id: notificationId, userId },
        data: { status: NotificationStatus.READ, readAt: new Date() },
      })
      .then(() => this.prisma.notification.findUnique({ where: { id: notificationId } }));
  }

  async markAllAsRead(tenantId: string, userId: string): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: { tenantId, userId, status: NotificationStatus.UNREAD },
      data: { status: NotificationStatus.READ, readAt: new Date() },
    });
    return result.count;
  }

  async countNotificationsByUser(
    tenantId: string,
    userId: string,
    status?: NotificationStatus
  ): Promise<number> {
    return this.prisma.notification.count({
      where: {
        tenantId,
        userId,
        ...(status && { status }),
      },
    });
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<Notification | null> {
    return this.prisma.notification.findUnique({
      where: { idempotencyKey },
    });
  }
}
