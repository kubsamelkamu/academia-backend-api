import { Module } from '@nestjs/common';
import { TenantController } from './tenant.controller';
import { TenantService } from './tenant.service';
import { TenantRepository } from './tenant.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionModule } from '../subscription/subscription.module';

@Module({
  imports: [SubscriptionModule],
  controllers: [TenantController],
  providers: [TenantService, TenantRepository, PrismaService],
  exports: [TenantService, TenantRepository],
})
export class TenantModule {}
