import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis, { ChainableCommander } from 'ioredis';

type CallStartResult = {
  roomId: string;
  meetingRoomName: string;
  startedByUserId: string;
  startedAt: string;
  sessionCreated: boolean;
  participantCount: number;
};

type CallJoinResult = {
  roomId: string;
  active: boolean;
  meetingRoomName: string | null;
  participantCount: number;
};

type CallLeaveResult = {
  roomId: string;
  meetingRoomName: string | null;
  ended: boolean;
  participantCount: number;
};

type CallEndResult = {
  roomId: string;
  meetingRoomName: string | null;
  endedByUserId: string;
  endedAt: string;
};

@Injectable()
export class ChatCallPresenceService implements OnModuleDestroy {
  private readonly logger = new Logger(ChatCallPresenceService.name);
  private readonly ttlSeconds = 24 * 60 * 60;
  private readonly transactionRetries = 3;
  private client: Redis | null = null;

  constructor() {}

  private getClient() {
    if (this.client) {
      return this.client;
    }

    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error('REDIS_NOT_CONFIGURED');
    }

    this.client = new Redis(redisUrl, {
      // Enforce TLS for all 'rediss://' URLs, common for cloud providers like Heroku
      ...(redisUrl.startsWith('rediss://') && {
        tls: {
          // Necessary for many cloud Redis providers (self-signed cert chain)
          rejectUnauthorized: false,
        },
      }),
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });

    this.client.on('error', (error) => {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Redis client error: ${message}`);
    });

    return this.client;
  }

  async onModuleDestroy() {
    if (!this.client) return;
    await this.client.quit();
    this.client = null;
  }

  private metadataKey(roomId: string) {
    return `chat:call:${roomId}`;
  }

  private participantsKey(roomId: string) {
    return `chat:call:${roomId}:participants`;
  }

  private userRoomsKey(userId: string) {
    return `chat:call:user:${userId}:rooms`;
  }

  private async refreshActiveTtl(roomId: string, userId?: string) {
    const client = this.getClient();
    const metadataKey = this.metadataKey(roomId);
    const participantsKey = this.participantsKey(roomId);
    const pipeline = client
      .multi()
      .expire(metadataKey, this.ttlSeconds)
      .expire(participantsKey, this.ttlSeconds);
    if (userId) {
      pipeline.expire(this.userRoomsKey(userId), this.ttlSeconds);
    }
    await pipeline.exec();
  }

  private async executeWithOptimisticRetry<T>(
    watchedKeys: string[],
    operation: (client: Redis) => Promise<{ result: T; transaction?: ChainableCommander }>
  ): Promise<T> {
    const client = this.getClient();

    for (let attempt = 0; attempt < this.transactionRetries; attempt += 1) {
      await client.watch(...watchedKeys);

      try {
        const plan = await operation(client);
        if (!plan.transaction) {
          return plan.result;
        }

        const execResult = await plan.transaction.exec();
        if (execResult !== null) {
          return plan.result;
        }
      } finally {
        await client.unwatch();
      }
    }

    throw new Error('CALL_PRESENCE_CONFLICT');
  }

  async getActiveCallSession(roomId: string) {
    const client = this.getClient();
    const metadataKey = this.metadataKey(roomId);
    const metadata = await client.hgetall(metadataKey);

    if (!metadata || metadata.active !== '1') {
      return null;
    }

    return {
      roomId,
      projectGroupId: metadata.projectGroupId,
      meetingRoomName: metadata.meetingRoomName,
      startedByUserId: metadata.startedByUserId,
      startedAt: metadata.startedAt,
      active: true,
    };
  }

  async startCall(params: {
    roomId: string;
    projectGroupId: string;
    meetingRoomName: string;
    userId: string;
  }): Promise<CallStartResult> {
    const metadataKey = this.metadataKey(params.roomId);
    const participantsKey = this.participantsKey(params.roomId);
    const userRoomsKey = this.userRoomsKey(params.userId);

    return this.executeWithOptimisticRetry<CallStartResult>(
      [metadataKey, participantsKey, userRoomsKey],
      async (client) => {
        const startedAt = new Date().toISOString();
        const metadata = await client.hgetall(metadataKey);
        const existingActive = metadata.active;
        const currentParticipantCount = await client.scard(participantsKey);
        const isExistingParticipant =
          (await client.sismember(participantsKey, params.userId)) === 1;
        const effectiveStartedAt = metadata.startedAt || startedAt;
        const effectiveStartedBy = metadata.startedByUserId || params.userId;
        const effectiveMeetingRoomName = metadata.meetingRoomName || params.meetingRoomName;
        const participantCount = currentParticipantCount + (isExistingParticipant ? 0 : 1);

        const transaction = client
          .multi()
          .hset(metadataKey, {
            projectGroupId: params.projectGroupId,
            meetingRoomName: effectiveMeetingRoomName,
            startedByUserId: effectiveStartedBy,
            startedAt: effectiveStartedAt,
            active: '1',
          })
          .sadd(participantsKey, params.userId)
          .sadd(userRoomsKey, params.roomId)
          .expire(metadataKey, this.ttlSeconds)
          .expire(participantsKey, this.ttlSeconds)
          .expire(userRoomsKey, this.ttlSeconds);

        return {
          transaction,
          result: {
            roomId: params.roomId,
            meetingRoomName: effectiveMeetingRoomName,
            startedByUserId: effectiveStartedBy,
            startedAt: effectiveStartedAt,
            sessionCreated: existingActive !== '1',
            participantCount,
          },
        };
      }
    );
  }

  async joinCall(params: { roomId: string; userId: string }): Promise<CallJoinResult> {
    const metadataKey = this.metadataKey(params.roomId);
    const participantsKey = this.participantsKey(params.roomId);
    const userRoomsKey = this.userRoomsKey(params.userId);

    return this.executeWithOptimisticRetry<CallJoinResult>(
      [metadataKey, participantsKey, userRoomsKey],
      async (client) => {
        const metadata = await client.hgetall(metadataKey);
        if (!metadata || metadata.active !== '1') {
          return {
            result: {
              roomId: params.roomId,
              active: false,
              meetingRoomName: null,
              participantCount: 0,
            },
          };
        }

        const currentParticipantCount = await client.scard(participantsKey);
        const isExistingParticipant =
          (await client.sismember(participantsKey, params.userId)) === 1;
        const participantCount = currentParticipantCount + (isExistingParticipant ? 0 : 1);

        const transaction = client
          .multi()
          .sadd(participantsKey, params.userId)
          .sadd(userRoomsKey, params.roomId)
          .expire(metadataKey, this.ttlSeconds)
          .expire(participantsKey, this.ttlSeconds)
          .expire(userRoomsKey, this.ttlSeconds);

        return {
          transaction,
          result: {
            roomId: params.roomId,
            active: true,
            meetingRoomName: metadata.meetingRoomName ?? null,
            participantCount,
          },
        };
      }
    );
  }

  async leaveCall(params: { roomId: string; userId: string }): Promise<CallLeaveResult> {
    const metadataKey = this.metadataKey(params.roomId);
    const participantsKey = this.participantsKey(params.roomId);
    const userRoomsKey = this.userRoomsKey(params.userId);

    return this.executeWithOptimisticRetry<CallLeaveResult>(
      [metadataKey, participantsKey, userRoomsKey],
      async (client) => {
        const metadata = await client.hgetall(metadataKey);
        const currentParticipantCount = await client.scard(participantsKey);
        const isExistingParticipant =
          (await client.sismember(participantsKey, params.userId)) === 1;
        const nextParticipantCount = isExistingParticipant
          ? Math.max(0, currentParticipantCount - 1)
          : currentParticipantCount;
        const meetingRoomName = metadata.meetingRoomName ?? null;
        const isActive = metadata.active === '1';

        const transaction = client
          .multi()
          .srem(participantsKey, params.userId)
          .srem(userRoomsKey, params.roomId);
        if (isActive && nextParticipantCount > 0) {
          transaction
            .expire(metadataKey, this.ttlSeconds)
            .expire(participantsKey, this.ttlSeconds)
            .expire(userRoomsKey, this.ttlSeconds);
        } else {
          transaction.del(metadataKey).del(participantsKey);
        }

        return {
          transaction,
          result: {
            roomId: params.roomId,
            meetingRoomName,
            ended: nextParticipantCount === 0,
            participantCount: nextParticipantCount,
          },
        };
      }
    );
  }

  async endCall(params: { roomId: string; endedByUserId: string }): Promise<CallEndResult> {
    const metadataKey = this.metadataKey(params.roomId);
    const participantsKey = this.participantsKey(params.roomId);

    return this.executeWithOptimisticRetry<CallEndResult>(
      [metadataKey, participantsKey],
      async (client) => {
        const metadata = await client.hgetall(metadataKey);
        const participantUserIds = await client.smembers(participantsKey);

        const transaction = client.multi().del(metadataKey).del(participantsKey);
        for (const userId of participantUserIds) {
          transaction.srem(this.userRoomsKey(userId), params.roomId);
        }
        transaction.srem(this.userRoomsKey(params.endedByUserId), params.roomId);

        return {
          transaction,
          result: {
            roomId: params.roomId,
            meetingRoomName: metadata.meetingRoomName ?? null,
            endedByUserId: params.endedByUserId,
            endedAt: new Date().toISOString(),
          },
        };
      }
    );
  }

  async leaveAllCallsForUser(userId: string) {
    const client = this.getClient();
    const rooms = await client.smembers(this.userRoomsKey(userId));
    const results: Array<{
      roomId: string;
      meetingRoomName: string | null;
      ended: boolean;
      participantCount: number;
    }> = [];

    for (const roomId of rooms) {
      const result = await this.leaveCall({ roomId, userId });
      results.push(result);
    }

    return results;
  }
}
