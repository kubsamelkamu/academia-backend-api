import { Module } from '@nestjs/common';
import { DepartmentHeadStatusScheduler } from './department-head-status.scheduler';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from '../notification/notification.module';
import { EmailModule } from '../../core/email/email.module';
import { StorageModule } from '../../core/storage/storage.module';
import { QueueModule } from '../../core/queue/queue.module';
import { PrismaService } from '../../prisma/prisma.service';
import { DepartmentGroupSizeSettingController } from './department-group-size-setting.controller';
import { DepartmentGroupSizeSettingService } from './department-group-size-setting.service';
import { DepartmentGroupSizeSettingRepository } from './department-group-size-setting.repository';
import { DepartmentDocumentTemplatesController } from './department-document-templates.controller';
import { DepartmentDocumentTemplatesService } from './department-document-templates.service';
import { DepartmentDocumentTemplatesRepository } from './department-document-templates.repository';
import { DepartmentAnnouncementsController } from './department-announcements.controller';
import { DepartmentAnnouncementsService } from './department-announcements.service';
import { DepartmentAnnouncementsRepository } from './department-announcements.repository';
import { DepartmentAnnouncementScheduler } from './department-announcement.scheduler';
import { CoordinatorAdvisorNotificationsController } from './coordinator-advisor-notifications.controller';
import { CoordinatorAdvisorNotificationsRepository } from './coordinator-advisor-notifications.repository';
import { CoordinatorAdvisorNotificationsService } from './coordinator-advisor-notifications.service';

@Module({
  imports: [AuthModule, NotificationModule, EmailModule, StorageModule, QueueModule],
  controllers: [
    DepartmentGroupSizeSettingController,
    DepartmentDocumentTemplatesController,
    DepartmentAnnouncementsController,
    CoordinatorAdvisorNotificationsController,
  ],
  providers: [
    DepartmentHeadStatusScheduler,
    PrismaService,
    DepartmentGroupSizeSettingRepository,
    DepartmentGroupSizeSettingService,
    DepartmentDocumentTemplatesRepository,
    DepartmentDocumentTemplatesService,
    DepartmentAnnouncementsRepository,
    DepartmentAnnouncementsService,
    DepartmentAnnouncementScheduler,
    CoordinatorAdvisorNotificationsRepository,
    CoordinatorAdvisorNotificationsService,
  ],
})
export class DepartmentModule {}
