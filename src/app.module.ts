import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaService } from './prisma/prisma.service';
import { RedisHealthIndicator } from './core/queue/redis.health';

// Configuration files
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import authConfig from './config/auth.config';
import storageConfig from './config/storage.config';
import emailConfig from './config/email.config';
import pushConfig from './config/push.config';

// Core modules
import { DatabaseModule } from './core/database/database.module';
import { LoggerModule } from './core/logger/logger.module';
import { EmailModule } from './core/email/email.module';
import { QueueModule } from './core/queue/queue.module';
import { TerminusModule } from '@nestjs/terminus';

// Business modules
import { AuthModule } from './modules/auth/auth.module';
import { AdminModule } from './modules/admin/admin.module';
import { InvitationsModule } from './modules/invitations/invitations.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { ProjectModule } from './modules/project/project.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { ContactModule } from './modules/contact/contact.module';
import { NotificationModule } from './modules/notification/notification.module';
import { DepartmentModule } from './modules/department/department.module';
import { MilestoneModule } from './modules/milestone/milestone.module';
import { StudentProfileModule } from './modules/student-profile/student-profile.module';
import { GroupLeaderRequestModule } from './modules/group-leader-request/group-leader-request.module';
import { ProjectGroupModule } from './modules/project-group/project-group.module';
import { RootHealthController } from './health.controller';

// Guards
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';

@Module({
  imports: [
    // ====================
    // CONFIGURATION
    // ====================
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, authConfig, storageConfig, emailConfig, pushConfig],
      envFilePath: [`.env.${process.env.NODE_ENV || 'development'}`, '.env'],
    }),

    // ====================
    // CORE MODULES
    // ====================
    DatabaseModule,
    LoggerModule,
    EmailModule,
    QueueModule,
    TerminusModule,

    // ====================
    // FRAMEWORK MODULES
    // ====================
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: (config.get('THROTTLE_TTL') || 60) * 1000,
            limit: config.get('THROTTLE_LIMIT') || 100,
          },
        ],
      }),
    }),
    ScheduleModule.forRoot(),

    // ====================
    // BUSINESS MODULES
    // ====================
    AuthModule,
    AdminModule,
    InvitationsModule,
    TenantModule,
    ProjectModule,
    AnalyticsModule,
    ContactModule,
    NotificationModule,
    DepartmentModule,
    MilestoneModule,
    StudentProfileModule,
    GroupLeaderRequestModule,
    ProjectGroupModule,
  ],

  controllers: [RootHealthController],

  providers: [
    PrismaService,
    RedisHealthIndicator,
    // Global JWT Authentication Guard
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Global Rate Limiting Guard
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],

  exports: [],
})
export class AppModule {}
