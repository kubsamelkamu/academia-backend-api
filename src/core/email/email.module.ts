import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { EmailService } from './email.service';
import { EmailDeliveryWebhookController } from './email-delivery-webhook.controller';
import { EmailDeliveryWebhookService } from './email-delivery-webhook.service';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  imports: [ConfigModule],
  controllers: [EmailDeliveryWebhookController],
  providers: [EmailService, EmailDeliveryWebhookService, PrismaService],
  exports: [EmailService],
})
export class EmailModule {}
