import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../core/database/database.module';
import { PaddleWebhookController } from './webhooks/paddle-webhook.controller';
import { PaddleWebhookService } from './webhooks/paddle-webhook.service';
import { DepartmentBillingController } from './billing/department-billing.controller';
import { DepartmentBillingService } from './billing/department-billing.service';
import { DepartmentUsageService } from './usage/department-usage.service';


@Module({
  imports: [DatabaseModule],
  controllers: [PaddleWebhookController, DepartmentBillingController],
  providers: [PaddleWebhookService, DepartmentBillingService, DepartmentUsageService],
  exports: [DepartmentUsageService, PaddleWebhookService],
})
export class SubscriptionModule {}
