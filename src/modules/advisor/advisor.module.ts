import { Module } from '@nestjs/common';
import { StorageModule } from '../../core/storage/storage.module';
import { PrismaService } from '../../prisma/prisma.service';
import { AdvisorController } from './advisor.controller';
import { AdvisorService } from './advisor.service';

@Module({
  imports: [StorageModule],
  controllers: [AdvisorController],
  providers: [PrismaService, AdvisorService],
})
export class AdvisorModule {}
