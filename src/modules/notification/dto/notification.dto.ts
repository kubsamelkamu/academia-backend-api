import { ApiProperty } from '@nestjs/swagger';
import { NotificationEventType, NotificationSeverity, NotificationStatus } from '@prisma/client';

export class NotificationDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  eventType: NotificationEventType;

  @ApiProperty()
  severity: NotificationSeverity;

  @ApiProperty()
  title: string;

  @ApiProperty()
  message: string;

  @ApiProperty({ required: false })
  metadata?: any;

  @ApiProperty()
  status: NotificationStatus;

  @ApiProperty({ required: false })
  readAt?: Date | null;

  @ApiProperty()
  createdAt: Date;
}

export class GetNotificationsResponseDto {
  @ApiProperty({ type: [NotificationDto] })
  notifications: NotificationDto[];

  @ApiProperty({ description: 'Total number of notifications matching the filter' })
  total: number;

  @ApiProperty({ description: 'Total number of unread notifications' })
  unreadCount: number;

  @ApiProperty({ description: 'Current page limit', required: false })
  limit?: number;

  @ApiProperty({ description: 'Current page offset', required: false })
  offset?: number;
}

export class UnreadCountResponseDto {
  @ApiProperty()
  count: number;
}

export class MarkAsReadResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty({ type: NotificationDto, required: false })
  notification?: NotificationDto;
}

export class MarkAllAsReadResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  markedCount: number;
}