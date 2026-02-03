import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../core/database/database.module';
import { AdminSubscriptionsController } from './admin-subscriptions.controller';
import { AdminSubscriptionsService } from './admin-subscriptions.service';

@Module({
  imports: [DatabaseModule],
  controllers: [AdminSubscriptionsController],
  providers: [AdminSubscriptionsService],
})
export class AdminSubscriptionsModule {}
