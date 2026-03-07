import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { NotificationPushService } from './notification-push.service';
import {
  PushSubscribeRequestDto,
  PushSubscribeResponseDto,
  PushUnsubscribeResponseDto,
  VapidPublicKeyResponseDto,
} from './dto/push-subscription.dto';

@ApiTags('Notifications')
@ApiBearerAuth('access-token')
@Controller({ path: 'notifications/push', version: '1' })
@UseGuards(JwtAuthGuard)
export class NotificationPushController {
  constructor(private readonly push: NotificationPushService) {}

  @Get('vapid-public-key')
  @ApiOperation({ summary: 'Get VAPID public key for Web Push subscription' })
  @ApiResponse({ status: 200, type: VapidPublicKeyResponseDto })
  getVapidPublicKey(): VapidPublicKeyResponseDto {
    return { publicKey: this.push.getVapidPublicKey() };
  }

  @Post('subscribe')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Subscribe current user to Web Push' })
  @ApiResponse({ status: 200, type: PushSubscribeResponseDto })
  async subscribe(
    @GetUser() user: any,
    @Body() dto: PushSubscribeRequestDto,
    @Req() req: Request
  ): Promise<PushSubscribeResponseDto> {
    const userAgent = (req.headers['user-agent'] as string | undefined) ?? null;

    await this.push.subscribe({
      tenantId: user.tenantId,
      userId: user.sub,
      endpoint: dto.endpoint,
      p256dh: dto.keys.p256dh,
      auth: dto.keys.auth,
      expirationTime: dto.expirationTime,
      userAgent,
    });

    return { success: true };
  }

  @ApiOperation({ summary: 'Unsubscribe current user from Web Push (single endpoint or all)' })
  @ApiQuery({
    name: 'endpoint',
    required: false,
    description: 'If provided, removes only that endpoint; otherwise removes all for the user',
  })
  @ApiResponse({ status: 200, type: PushUnsubscribeResponseDto })
  @Delete('unsubscribe')
  @HttpCode(HttpStatus.OK)
  async unsubscribe(
    @GetUser() user: any,
    @Query('endpoint') endpoint?: string
  ): Promise<PushUnsubscribeResponseDto> {
    const removed = await this.push.unsubscribe({
      tenantId: user.tenantId,
      userId: user.sub,
      endpoint: endpoint || undefined,
    });

    return { success: true, removed };
  }
}
