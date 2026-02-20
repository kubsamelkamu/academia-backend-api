import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  async pingCheck(key: string): Promise<HealthIndicatorResult> {
    const redisUrl = this.configService.get<string>('queue.redisUrl');
    if (!redisUrl) {
      throw new HealthCheckError(
        'RedisHealthIndicator',
        this.getStatus(key, false, { message: 'Redis URL not configured' })
      );
    }

    const client = new Redis(redisUrl, {
      // Enforce TLS for all 'rediss://' URLs, common for cloud providers like Heroku
      ...(redisUrl.startsWith('rediss://') && {
        tls: {
          rejectUnauthorized: false, // Necessary for many cloud Redis providers
        },
      }),
      maxRetriesPerRequest: 1,
      connectTimeout: 5000,
    });

    try {
      const pong = await client.ping();
      if (pong === 'PONG') {
        client.disconnect();
        return this.getStatus(key, true);
      }
      throw new Error('Redis ping failed');
    } catch (error) {
      client.disconnect();
      const errorMessage = error instanceof Error ? error.message : 'Unknown Redis error';
      throw new HealthCheckError(
        'RedisHealthIndicator',
        this.getStatus(key, false, { message: errorMessage })
      );
    }
  }
}
