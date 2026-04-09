import { Module } from '@nestjs/common';

import { EmailModule } from '../../core/email/email.module';
import { QueueModule } from '../../core/queue/queue.module';
import { StorageModule } from '../../core/storage/storage.module';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from '../notification/notification.module';
import { ProjectModule } from '../project/project.module';

import { ProjectGroupController } from './project-group.controller';
import { ProjectGroupTaskController } from './project-group-task.controller';
import { ProjectGroupRepository } from './project-group.repository';
import { ProjectGroupProposalReminderScheduler } from './project-group-proposal-reminder.scheduler';
import { ProjectGroupMeetingReminderScheduler } from './project-group-meeting-reminder.scheduler';
import { ProjectGroupService } from './project-group.service';
import { ProjectGroupTaskRepository } from './project-group-task.repository';
import { ProjectGroupTaskService } from './project-group-task.service';
import { ProjectGroupTaskReminderScheduler } from './project-group-task-reminder.scheduler';

@Module({
  imports: [AuthModule, QueueModule, EmailModule, StorageModule, NotificationModule, ProjectModule],
  controllers: [ProjectGroupController, ProjectGroupTaskController],
  providers: [
    ProjectGroupService,
    ProjectGroupRepository,
    ProjectGroupProposalReminderScheduler,
    ProjectGroupMeetingReminderScheduler,
    ProjectGroupTaskService,
    ProjectGroupTaskRepository,
    ProjectGroupTaskReminderScheduler,
  ],
})
export class ProjectGroupModule {}
