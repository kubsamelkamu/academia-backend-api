import { Module } from '@nestjs/common';
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
})
export class AppModule {}
