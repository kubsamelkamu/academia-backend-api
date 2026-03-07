import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { randomUUID } from 'crypto';

export type StoredPushSubscription = {
  id: string;
  tenantId: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  expirationTime: bigint | null;
  userAgent: string | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class PushSubscriptionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsertForUser(params: {
    tenantId: string;
    userId: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    expirationTime?: number | null;
    userAgent?: string | null;
  }): Promise<void> {
    const id = randomUUID();
    const expirationBigInt =
      typeof params.expirationTime === 'number' && Number.isFinite(params.expirationTime)
        ? BigInt(Math.trunc(params.expirationTime))
        : null;

    await this.prisma.$executeRaw`
      INSERT INTO "push_subscriptions" (
        "id",
        "tenantId",
        "userId",
        "endpoint",
        "p256dh",
        "auth",
        "expirationTime",
        "userAgent",
        "created_at",
        "updated_at"
      )
      VALUES (
        ${id},
        ${params.tenantId},
        ${params.userId},
        ${params.endpoint},
        ${params.p256dh},
        ${params.auth},
        ${expirationBigInt},
        ${params.userAgent ?? null},
        NOW(),
        NOW()
      )
      ON CONFLICT ("endpoint") DO UPDATE SET
        "tenantId" = EXCLUDED."tenantId",
        "userId" = EXCLUDED."userId",
        "p256dh" = EXCLUDED."p256dh",
        "auth" = EXCLUDED."auth",
        "expirationTime" = EXCLUDED."expirationTime",
        "userAgent" = EXCLUDED."userAgent",
        "updated_at" = NOW()
    `;
  }

  async deleteAllForUser(tenantId: string, userId: string): Promise<number> {
    const result = await this.prisma.$executeRaw`
      DELETE FROM "push_subscriptions"
      WHERE "tenantId" = ${tenantId}
        AND "userId" = ${userId}
    `;
    // Prisma returns number of affected rows for $executeRaw on Postgres.
    return Number(result);
  }

  async deleteByEndpointForUser(params: {
    tenantId: string;
    userId: string;
    endpoint: string;
  }): Promise<number> {
    const result = await this.prisma.$executeRaw`
      DELETE FROM "push_subscriptions"
      WHERE "tenantId" = ${params.tenantId}
        AND "userId" = ${params.userId}
        AND "endpoint" = ${params.endpoint}
    `;
    return Number(result);
  }

  async deleteByEndpoint(endpoint: string): Promise<number> {
    const result = await this.prisma.$executeRaw`
      DELETE FROM "push_subscriptions"
      WHERE "endpoint" = ${endpoint}
    `;
    return Number(result);
  }

  async findForUser(tenantId: string, userId: string): Promise<StoredPushSubscription[]> {
    const rows = (await this.prisma.$queryRaw`
      SELECT
        "id",
        "tenantId",
        "userId",
        "endpoint",
        "p256dh",
        "auth",
        "expirationTime",
        "userAgent",
        "last_used_at" AS "lastUsedAt",
        "created_at" AS "createdAt",
        "updated_at" AS "updatedAt"
      FROM "push_subscriptions"
      WHERE "tenantId" = ${tenantId}
        AND "userId" = ${userId}
      ORDER BY COALESCE("last_used_at", "created_at") DESC
    `) as StoredPushSubscription[];

    return rows;
  }

  async markLastUsed(endpoint: string): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE "push_subscriptions"
      SET "last_used_at" = NOW(), "updated_at" = NOW()
      WHERE "endpoint" = ${endpoint}
    `;
  }
}
