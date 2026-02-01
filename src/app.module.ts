import { Module, Controller, Get } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';

// Configuration files
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import authConfig from './config/auth.config';
import storageConfig from './config/storage.config';
import emailConfig from './config/email.config';
import subscriptionConfig from './config/subscription.config';

// Core modules
import { DatabaseModule } from './core/database/database.module';
import { LoggerModule } from './core/logger/logger.module';

// Business modules
import { AuthModule } from './modules/auth/auth.module';

// Guards
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';

// ====================
// SIMPLE HEALTH CONTROLLER
// ====================
@Controller({ version: '1' })
@ApiTags('Health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'API root' })
  @ApiOkResponse({
    description: 'API is running',
    schema: {
      example: {
        status: 'ok',
        message: 'Academic Project Platform API is running',
        timestamp: '2026-01-31T00:00:00.000Z',
        service: 'academic-project-platform',
        environment: 'development',
        docs: '/api',
      },
    },
  })
  getRoot() {
    return {
      status: 'ok',
      message: 'Academic Project Platform API is running',
      timestamp: new Date().toISOString(),
      service: 'academic-project-platform',
      environment: process.env.NODE_ENV || 'development',
      docs: '/api',
    };
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check' })
  @ApiOkResponse({
    description: 'Service health details',
    schema: {
      example: {
        status: 'ok',
        timestamp: '2026-01-31T00:00:00.000Z',
        service: 'academic-project-platform',
        uptime: 123.45,
        environment: 'development',
      },
    },
  })
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'academic-project-platform',
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
    };
  }

  @Get('ping')
  @ApiOperation({ summary: 'Ping' })
  @ApiOkResponse({
    description: 'Ping response',
    schema: {
      example: {
        message: 'pong',
        timestamp: 1738281600000,
      },
    },
  })
  ping() {
    return {
      message: 'pong',
      timestamp: Date.now(),
    };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe' })
  @ApiOkResponse({
    description: 'Readiness response',
    schema: {
      example: {
        status: 'ready',
        timestamp: '2026-01-31T00:00:00.000Z',
      },
    },
  })
  readiness() {
    return {
      status: 'ready',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness probe' })
  @ApiOkResponse({
    description: 'Liveness response',
    schema: {
      example: {
        status: 'alive',
        timestamp: '2026-01-31T00:00:00.000Z',
      },
    },
  })
  liveness() {
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
    };
  }
}

@Module({
  imports: [
    // ====================
    // CONFIGURATION
    // ====================
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, authConfig, storageConfig, emailConfig, subscriptionConfig],
      envFilePath: [`.env.${process.env.NODE_ENV || 'development'}`, '.env'],
    }),

    // ====================
    // CORE MODULES
    // ====================
    DatabaseModule,
    LoggerModule,

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
  ],

  controllers: [HealthController],

  providers: [
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
