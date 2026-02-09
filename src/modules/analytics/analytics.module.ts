import { Module } from '@nestjs/common';
import { AnalyticsController, ReportsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AnalyticsRepository } from './analytics.repository';
import { DatabaseModule } from '../../core/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [AnalyticsController, ReportsController],
  providers: [AnalyticsService, AnalyticsRepository],
  exports: [AnalyticsService, AnalyticsRepository],
})
export class AnalyticsModule {}