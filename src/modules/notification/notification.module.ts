import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NotificationService } from './notification.service';
import { NotificationRepository } from './notification.repository';
import { NotificationsController } from './notification.controller';
import { NotificationGateway } from './notification.gateway';

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
  controllers: [NotificationsController],
  providers: [NotificationService, NotificationRepository, NotificationGateway],
  exports: [NotificationService, NotificationGateway],
})
export class NotificationModule {}
