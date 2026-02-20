import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../core/database/database.module';
import { EmailModule } from '../../core/email/email.module';
import { QueueModule } from '../../core/queue/queue.module';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';

@Module({
  imports: [DatabaseModule, EmailModule, QueueModule],
  controllers: [InvitationsController],
  providers: [InvitationsService],
  exports: [InvitationsService],
})
export class InvitationsModule {}
