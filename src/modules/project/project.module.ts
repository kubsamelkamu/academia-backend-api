import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { ProjectRepository } from './project.repository';
import { DatabaseModule } from '../../core/database/database.module';
import { NotificationModule } from '../notification/notification.module';
import { StorageModule } from '../../core/storage/storage.module';
import { QueueModule } from '../../core/queue/queue.module';
import { EmailModule } from '../../core/email/email.module';
import { ProjectEmailService } from './project-email.service';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    NotificationModule,
    StorageModule,
    QueueModule,
    EmailModule,
  ],
  controllers: [ProjectController],
  providers: [ProjectService, ProjectRepository, ProjectEmailService],
  exports: [ProjectService, ProjectRepository, ProjectEmailService],
})
export class ProjectModule {}
