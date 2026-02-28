import { Module } from '@nestjs/common';
import { DepartmentHeadStatusScheduler } from './department-head-status.scheduler';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from '../notification/notification.module';
import { EmailModule } from '../../core/email/email.module';
import { PrismaService } from '../../prisma/prisma.service';
import { DepartmentGroupSizeSettingController } from './department-group-size-setting.controller';
import { DepartmentGroupSizeSettingService } from './department-group-size-setting.service';
import { DepartmentGroupSizeSettingRepository } from './department-group-size-setting.repository';

@Module({
  imports: [AuthModule, NotificationModule, EmailModule],
  controllers: [DepartmentGroupSizeSettingController],
  providers: [
    DepartmentHeadStatusScheduler,
    PrismaService,
    DepartmentGroupSizeSettingRepository,
    DepartmentGroupSizeSettingService,
  ],
})
export class DepartmentModule {}
