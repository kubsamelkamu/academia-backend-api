import {
  Controller,
  Get,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  PrismaHealthIndicator,
  MemoryHealthIndicator,
  HealthCheckResult,
} from '@nestjs/terminus';
import { Public } from './common/decorators/public.decorator';
import { RedisHealthIndicator } from './core/queue/redis.health';
import { PrismaService } from './prisma/prisma.service';

@ApiTags('Health')
@Controller({ path: 'health', version: '1' })
export class RootHealthController {
  constructor(
    private health: HealthCheckService,
    private prismaIndicator: PrismaHealthIndicator,
    private memory: MemoryHealthIndicator,
    private redis: RedisHealthIndicator,
    private prisma: PrismaService,
  ) {}

  @Get()
  @Public()
  @HealthCheck()
  @ApiOperation({ summary: 'Get system health status' })
  async check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.prismaIndicator.pingCheck('database', this.prisma),
      () => this.redis.pingCheck('redis'),
      // The process should not use more than 300MB memory
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),
      // The process should not have more than 300MB RSS memory allocated
      () => this.memory.checkRSS('memory_rss', 300 * 1024 * 1024),
    ]);
  }
}