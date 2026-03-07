import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NotificationService } from './notification.service';
import { NotificationRepository } from './notification.repository';
import { NotificationsController } from './notification.controller';
import { NotificationGateway } from './notification.gateway';
import { NotificationPushController } from './notification-push.controller';
import { NotificationPushService } from './notification-push.service';
import { PushSubscriptionRepository } from './push-subscription.repository';
import { WebPushService } from './web-push.service';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('auth.jwtSecret'),
      }),
    }),
  ],
  controllers: [NotificationsController, NotificationPushController],
  providers: [
    NotificationService,
    NotificationRepository,
    NotificationGateway,
    NotificationPushService,
    PushSubscriptionRepository,
    WebPushService,
  ],
  exports: [NotificationService, NotificationGateway, WebPushService],
})
export class NotificationModule {}
