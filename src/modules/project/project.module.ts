import { Module } from '@nestjs/common';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { ProjectRepository } from './project.repository';
import { DatabaseModule } from '../../core/database/database.module';
import { NotificationModule } from '../notification/notification.module';
import { StorageModule } from '../../core/storage/storage.module';

@Module({
  imports: [DatabaseModule, NotificationModule, StorageModule],
  controllers: [ProjectController],
  providers: [ProjectService, ProjectRepository],
  exports: [ProjectService, ProjectRepository],
})
export class ProjectModule {}
