import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { QueueService } from './queue.service';
import { EmailProcessor } from './email.processor';
import { EmailModule } from '../email/email.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { buildBullRedisOptions } from './redis.options';

const isWorkerDyno =
  (process.env.DYNO ?? '').startsWith('worker.') || process.env.WORKER === 'true';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL') || process.env.REDIS_URL;
        return {
          redis: buildBullRedisOptions(redisUrl),
          prefix: config.get<string>('BULL_PREFIX') || 'academia',
        };
      },
    }),
    BullModule.registerQueue({
      name: 'email',
    }),
    ...(isWorkerDyno ? [EmailModule] : []),
  ],
  providers: [QueueService, ...(isWorkerDyno ? [EmailProcessor] : [])],
  exports: [QueueService, BullModule],
})
export class QueueModule {}
