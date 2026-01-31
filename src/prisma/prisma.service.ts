import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

type PrismaClientCompat = PrismaClient & {
  $connect: () => Promise<void>;
  $disconnect: () => Promise<void>;
  $executeRaw: (query: any, ...values: any[]) => Promise<number>;
};

const asCompatClient = (client: PrismaClient): PrismaClientCompat => client as PrismaClientCompat;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
    });
  }

  async onModuleInit() {
    await asCompatClient(this).$connect();
  }

  async onModuleDestroy() {
    await asCompatClient(this).$disconnect();
  }
}
