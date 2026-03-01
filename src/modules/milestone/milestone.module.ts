import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MilestoneTemplatesController } from './milestone-templates.controller';
import { MilestoneTemplatesRepository } from './milestone-templates.repository';
import { MilestoneTemplatesService } from './milestone-templates.service';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [NotificationModule],
  controllers: [MilestoneTemplatesController],
  providers: [PrismaService, MilestoneTemplatesRepository, MilestoneTemplatesService],
  exports: [],
})
export class MilestoneModule {}
