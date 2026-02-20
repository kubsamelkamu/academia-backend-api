import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationService } from './notification.service';

import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

import { ROLES } from '../../common/constants/roles.constants';
import {
  NotificationDto,
  GetNotificationsResponseDto,
  MarkAsReadResponseDto,
  MarkAllAsReadResponseDto,
} from './dto/notification.dto';
import { NotificationStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

@ApiTags('Admin Notifications')
@ApiBearerAuth()
@Controller({ path: 'admin/notifications', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.PLATFORM_ADMIN)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'Get admin notifications' })
  @ApiResponse({
    status: 200,
    description: 'Notifications retrieved successfully',
    type: GetNotificationsResponseDto,
  })
  async getNotifications(
    @GetUser() user: any,
    @Query('status') status?: NotificationStatus,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number
  ): Promise<GetNotificationsResponseDto> {
    const notifications = await this.notificationService.getUserNotifications(
      user.tenantId,
      user.sub,
      { status, limit: limit ? +limit : undefined, offset: offset ? +offset : undefined }
    );
    const total = await this.notificationService.countNotificationsByUser(
      user.tenantId,
      user.sub,
      status
    );
    const unreadCount = await this.notificationService.getUnreadCount(user.tenantId, user.sub);

    return {
      notifications: notifications.map((n) => ({
        id: n.id,
        eventType: n.eventType,
        severity: n.severity,
        title: n.title,
        message: n.message,
        metadata: n.metadata,
        status: n.status,
        readAt: n.readAt,
        createdAt: n.createdAt,
      })),
      total,
      unreadCount,
      limit: limit ? +limit : undefined,
      offset: offset ? +offset : undefined,
    };
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get notification summary statistics' })
  @ApiResponse({ status: 200, description: 'Summary retrieved successfully' })
  async getNotificationSummary(@GetUser() user: any): Promise<{
    total: number;
    unread: number;
    bySeverity: { [key: string]: number };
    recent: NotificationDto[];
  }> {
    const [total, unread, recent] = await Promise.all([
      this.notificationService.countNotificationsByUser(user.tenantId, user.sub),
      this.notificationService.getUnreadCount(user.tenantId, user.sub),
      this.notificationService.getUserNotifications(user.tenantId, user.sub, {
        limit: 5,
        status: NotificationStatus.UNREAD,
      }),
    ]);

    // Get counts by severity for unread notifications
    const unreadNotifications = await this.notificationService.getUserNotifications(
      user.tenantId,
      user.sub,
      { status: NotificationStatus.UNREAD }
    );

    const bySeverity = unreadNotifications.reduce(
      (acc, n) => {
        acc[n.severity] = (acc[n.severity] || 0) + 1;
        return acc;
      },
      {} as { [key: string]: number }
    );

    return {
      total,
      unread,
      bySeverity,
      recent: recent.map((n) => ({
        id: n.id,
        eventType: n.eventType,
        severity: n.severity,
        title: n.title,
        message: n.message,
        metadata: n.metadata,
        status: n.status,
        readAt: n.readAt,
        createdAt: n.createdAt,
      })),
    };
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiResponse({
    status: 200,
    description: 'Notification marked as read',
    type: MarkAsReadResponseDto,
  })
  async markAsRead(
    @Param('id') notificationId: string,
    @GetUser() user: any
  ): Promise<MarkAsReadResponseDto> {
    const notification = await this.notificationService.markAsRead(notificationId, user.sub);
    return {
      success: !!notification,
      notification: notification
        ? {
            id: notification.id,
            eventType: notification.eventType,
            severity: notification.severity,
            title: notification.title,
            message: notification.message,
            metadata: notification.metadata,
            status: notification.status,
            readAt: notification.readAt,
            createdAt: notification.createdAt,
          }
        : undefined,
    };
  }

  @Patch('mark-all-read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiResponse({
    status: 200,
    description: 'All notifications marked as read',
    type: MarkAllAsReadResponseDto,
  })
  async markAllAsRead(@GetUser() user: any): Promise<MarkAllAsReadResponseDto> {
    const markedCount = await this.notificationService.markAllAsRead(user.tenantId, user.sub);
    return {
      success: true,
      markedCount,
    };
  }
}
