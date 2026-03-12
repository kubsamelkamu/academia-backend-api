import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { DepartmentModule } from '../department/department.module';
import { NotificationModule } from '../notification/notification.module';
import { ProjectModule } from '../project/project.module';
import { AdvisorController } from './advisor.controller';
import { AdvisorGateway } from './advisor.gateway';
import { AdvisorService } from './advisor.service';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    forwardRef(() => ProjectModule),
    NotificationModule,
    DepartmentModule,
  ],
  controllers: [AdvisorController],
  providers: [AdvisorService, AdvisorGateway],
  exports: [AdvisorService, AdvisorGateway],
})
export class AdvisorModule {}
