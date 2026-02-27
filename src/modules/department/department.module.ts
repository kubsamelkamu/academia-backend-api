import { Module } from '@nestjs/common';
import { DepartmentHeadStatusScheduler } from './department-head-status.scheduler';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from '../notification/notification.module';
import { EmailModule } from '../../core/email/email.module';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  imports: [AuthModule, NotificationModule, EmailModule],
  providers: [DepartmentHeadStatusScheduler, PrismaService],
})
export class DepartmentModule {}
