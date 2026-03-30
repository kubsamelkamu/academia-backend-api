import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

type PrismaClientCompat = PrismaClient & {
  $connect: () => Promise<void>;
  $disconnect: () => Promise<void>;
  $executeRaw: (query: any, ...values: any[]) => Promise<number>;
};

const asCompatClient = (client: PrismaClient): PrismaClientCompat => client as PrismaClientCompat;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is not set');
    }

    const isProduction = process.env.NODE_ENV === 'production';
    const pool = new Pool({
      connectionString: databaseUrl,
      ssl: isProduction ? { rejectUnauthorized: false } : undefined,
    });
    const adapter = new PrismaPg(pool);

    const shouldLogQueries = process.env.PRISMA_LOG_QUERIES === 'true';
    const shouldLogErrors = process.env.PRISMA_LOG_ERRORS === 'true';

    super({
      log:
        process.env.NODE_ENV === 'development'
          ? shouldLogQueries
            ? ['query', 'info', 'warn', ...(shouldLogErrors ? (['error'] as const) : [])]
            : [...(shouldLogErrors ? (['error'] as const) : [])]
          : [...(shouldLogErrors ? (['error'] as const) : [])],
      adapter,
    });
  }

  async onModuleInit() {
    await asCompatClient(this).$connect();
  }

  async onModuleDestroy() {
    await asCompatClient(this).$disconnect();
  }
}
