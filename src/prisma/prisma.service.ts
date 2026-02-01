import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
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
      ssl: isProduction ? { rejectUnauthorized: false } : undefined
    });
    const adapter = new PrismaPg(pool);

    super({
      log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
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
