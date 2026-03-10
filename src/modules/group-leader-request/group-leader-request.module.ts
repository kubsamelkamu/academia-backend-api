import { Module } from '@nestjs/common';

import { EmailModule } from '../../core/email/email.module';
import { QueueModule } from '../../core/queue/queue.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from '../notification/notification.module';

import { GroupLeaderRequestController } from './group-leader-request.controller';
import { GroupLeaderRequestRepository } from './group-leader-request.repository';
import { GroupLeaderRequestService } from './group-leader-request.service';

@Module({
  imports: [AuthModule, NotificationModule, QueueModule, EmailModule],
  controllers: [GroupLeaderRequestController],
  providers: [GroupLeaderRequestService, GroupLeaderRequestRepository],
})
export class GroupLeaderRequestModule {}
