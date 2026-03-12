import { Module } from '@nestjs/common';

import { EmailModule } from '../../core/email/email.module';
import { QueueModule } from '../../core/queue/queue.module';
import { StorageModule } from '../../core/storage/storage.module';
import { AuthModule } from '../auth/auth.module';

import { ProjectGroupController } from './project-group.controller';
import { ProjectGroupRepository } from './project-group.repository';
import { ProjectGroupService } from './project-group.service';

@Module({
  imports: [AuthModule, QueueModule, EmailModule, StorageModule],
  controllers: [ProjectGroupController],
  providers: [ProjectGroupService, ProjectGroupRepository],
})
export class ProjectGroupModule {}
