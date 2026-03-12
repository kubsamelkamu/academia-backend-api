import { Module } from '@nestjs/common';

import { EmailModule } from '../../core/email/email.module';
import { QueueModule } from '../../core/queue/queue.module';

import { AuthModule } from '../auth/auth.module';

import { StudentProfileController } from './student-profile.controller';
import { StudentProfileService } from './student-profile.service';
import { StudentProfileRepository } from './student-profile.repository';
import { StudentProfileCompletionReminderScheduler } from './student-profile-completion-reminder.scheduler';

@Module({
  imports: [AuthModule, QueueModule, EmailModule],
  controllers: [StudentProfileController],
  providers: [
    StudentProfileService,
    StudentProfileRepository,
    StudentProfileCompletionReminderScheduler,
  ],
})
export class StudentProfileModule {}
