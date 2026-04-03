import {
  BadRequestException,
  Controller,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import {
  NotificationDto,
  GetNotificationsResponseDto,
  UnreadCountResponseDto,
  MarkAsReadResponseDto,
  MarkAllAsReadResponseDto,
} from './dto/notification.dto';
import { NotificationEventType, NotificationStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

abstract class BaseNotificationsController {
  constructor(protected readonly notificationService: NotificationService) {}

  protected parseEventTypes(eventTypesRaw?: string): NotificationEventType[] | undefined {
    if (!eventTypesRaw?.trim()) {
      return undefined;
    }

    const requestedTypes = eventTypesRaw
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    if (!requestedTypes.length) {
      return undefined;
    }

    const allowedTypes = new Set(Object.values(NotificationEventType));
    const invalidType = requestedTypes.find(
      (value) => !allowedTypes.has(value as NotificationEventType)
    );
    if (invalidType) {
      throw new BadRequestException(`Invalid notification event type: ${invalidType}`);
    }

    return requestedTypes as NotificationEventType[];
  }

  @Get()
  @ApiOperation({ summary: 'Get notifications' })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: NotificationStatus,
    description: 'Filter by notification status (READ/UNREAD). Optional.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Max number of items to return. Optional.',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'Pagination offset. Optional.',
  })
  @ApiQuery({
    name: 'eventTypes',
    required: false,
    type: String,
    description:
      'Comma-separated notification event types to include. Useful for building filtered activity feeds.',
  })
  @ApiResponse({
    status: 200,
    description: 'Notifications retrieved successfully',
    type: GetNotificationsResponseDto,
  })
  async getNotifications(
    @GetUser() user: any,
    @Query('status') status?: NotificationStatus,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('eventTypes') eventTypesRaw?: string
  ): Promise<GetNotificationsResponseDto> {
    const eventTypes = this.parseEventTypes(eventTypesRaw);
    const notifications = await this.notificationService.getUserNotifications(
      user.tenantId,
      user.sub,
      {
        status,
        eventTypes,
        limit: limit ? +limit : undefined,
        offset: offset ? +offset : undefined,
      }
    );
    const total = await this.notificationService.countNotificationsByUser(
      user.tenantId,
      user.sub,
      status,
      eventTypes
    );
    const unreadCount = await this.notificationService.getUnreadCount(
      user.tenantId,
      user.sub,
      eventTypes
    );

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

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  @ApiResponse({
    status: 200,
    description: 'Unread count retrieved successfully',
    type: UnreadCountResponseDto,
  })
  async getUnreadCount(@GetUser() user: any): Promise<UnreadCountResponseDto> {
    const count = await this.notificationService.getUnreadCount(user.tenantId, user.sub);
    return { count };
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

@ApiTags('Notifications')
@ApiBearerAuth('access-token')
@Controller({ path: 'notifications', version: '1' })
@UseGuards(JwtAuthGuard)
export class NotificationsController extends BaseNotificationsController {
  constructor(notificationService: NotificationService) {
    super(notificationService);
  }
}
