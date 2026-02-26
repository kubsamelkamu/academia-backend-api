import { Module } from '@nestjs/common';
import { TenantController } from './tenant.controller';
import { TenantService } from './tenant.service';
import { TenantRepository } from './tenant.repository';
import { InvitationsModule } from '../invitations/invitations.module';
import { StorageModule } from '../../core/storage/storage.module';
import { EmailModule } from '../../core/email/email.module';
import { QueueModule } from '../../core/queue/queue.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [InvitationsModule, StorageModule, EmailModule, QueueModule, NotificationModule],
  controllers: [TenantController],
  providers: [TenantService, TenantRepository],
  exports: [TenantService, TenantRepository],
})
export class TenantModule {}
