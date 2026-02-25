import { Module } from '@nestjs/common';
import { AdminTenantVerificationController } from './admin-tenant-verification.controller';
import { AdminTenantVerificationService } from './admin-tenant-verification.service';
import { EmailModule } from '../../../core/email/email.module';
import { QueueModule } from '../../../core/queue/queue.module';
import { NotificationModule } from '../../notification/notification.module';

@Module({
  imports: [EmailModule, QueueModule, NotificationModule],
  controllers: [AdminTenantVerificationController],
  providers: [AdminTenantVerificationService],
})
export class AdminTenantVerificationModule {}
