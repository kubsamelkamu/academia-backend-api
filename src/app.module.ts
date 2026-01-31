import { Module, Controller, Get, Version } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';

// Configuration files
import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import authConfig from './config/auth.config';
import storageConfig from './config/storage.config';
import emailConfig from './config/email.config';
import subscriptionConfig from './config/subscription.config';

// ====================
// SIMPLE HEALTH CONTROLLER
// ====================
@Controller()
export class HealthController {
  @Version('1')
  @Get()
  getRoot() {
    return {
      status: 'ok',
      message: 'AcademiaC API is running',
      timestamp: new Date().toISOString(),
      service: 'academiac-api',
      environment: process.env.NODE_ENV || 'development',
      docs: '/api' // Optional: if you have Swagger/OpenAPI
    };
  }

  
  @Version('1')
  @Get('health')
  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'academiac-api',
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development'
    };
  }

  @Version('1')
  @Get('ping')
  ping() {
    return { 
      message: 'pong',
      timestamp: Date.now() 
    };
  }

  @Version('1')
  @Get('ready')
  readiness() {
    return {
      status: 'ready',
      timestamp: new Date().toISOString()
    };
  }

  @Version('1')
  @Get('live')
  liveness() {
    return {
      status: 'alive',
      timestamp: new Date().toISOString()
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
      load: [
        appConfig,
        databaseConfig, 
        authConfig,
        storageConfig,
        emailConfig,
        subscriptionConfig
      ],
      envFilePath: [`.env.${process.env.NODE_ENV || 'development'}`, '.env'],
    }),

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
  ],
  
  controllers: [HealthController],
  
  providers: [], 
  
  exports: [], 
})
export class AppModule {}