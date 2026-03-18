import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class ChatCallPresenceService implements OnModuleDestroy {
  private readonly logger = new Logger(ChatCallPresenceService.name);
  private readonly ttlSeconds = 24 * 60 * 60;
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

  private async refreshActiveTtl(roomId: string) {
    const client = this.getClient();
    const metadataKey = this.metadataKey(roomId);
    const participantsKey = this.participantsKey(roomId);
    await client.multi().expire(metadataKey, this.ttlSeconds).expire(participantsKey, this.ttlSeconds).exec();
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
  }) {
    const client = this.getClient();
    const metadataKey = this.metadataKey(params.roomId);
    const participantsKey = this.participantsKey(params.roomId);
    const userRoomsKey = this.userRoomsKey(params.userId);

    const startedAt = new Date().toISOString();
    const existingStartedAt = await client.hget(metadataKey, 'startedAt');
    const existingStartedByUserId = await client.hget(metadataKey, 'startedByUserId');
    const existingMeetingRoomName = await client.hget(metadataKey, 'meetingRoomName');
    const effectiveStartedAt = existingStartedAt || startedAt;
    const effectiveStartedBy = existingStartedByUserId || params.userId;
    const effectiveMeetingRoomName = existingMeetingRoomName || params.meetingRoomName;

    await client
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
      .expire(userRoomsKey, this.ttlSeconds)
      .exec();

    const participantCount = await client.scard(participantsKey);
    return {
      roomId: params.roomId,
      meetingRoomName: effectiveMeetingRoomName,
      startedByUserId: effectiveStartedBy,
      startedAt: effectiveStartedAt,
      participantCount,
    };
  }

  async joinCall(params: { roomId: string; userId: string }) {
    const client = this.getClient();
    const metadataKey = this.metadataKey(params.roomId);
    const participantsKey = this.participantsKey(params.roomId);
    const userRoomsKey = this.userRoomsKey(params.userId);

    const active = await client.hget(metadataKey, 'active');
    const meetingRoomName = await client.hget(metadataKey, 'meetingRoomName');
    if (active !== '1') {
      return { roomId: params.roomId, active: false, meetingRoomName: null, participantCount: 0 };
    }

    await client
      .multi()
      .sadd(participantsKey, params.userId)
      .sadd(userRoomsKey, params.roomId)
      .expire(metadataKey, this.ttlSeconds)
      .expire(participantsKey, this.ttlSeconds)
      .expire(userRoomsKey, this.ttlSeconds)
      .exec();

    const participantCount = await client.scard(participantsKey);
    return { roomId: params.roomId, active: true, meetingRoomName, participantCount };
  }

  async leaveCall(params: { roomId: string; userId: string }) {
    const client = this.getClient();
    const metadataKey = this.metadataKey(params.roomId);
    const participantsKey = this.participantsKey(params.roomId);
    const userRoomsKey = this.userRoomsKey(params.userId);
    const meetingRoomName = await client.hget(metadataKey, 'meetingRoomName');

    await client.multi().srem(participantsKey, params.userId).srem(userRoomsKey, params.roomId).exec();

    const participantCount = await client.scard(participantsKey);
    if (participantCount > 0) {
      await this.refreshActiveTtl(params.roomId);
      return { roomId: params.roomId, meetingRoomName, ended: false, participantCount };
    }

    await client.multi().del(metadataKey).del(participantsKey).exec();
    return { roomId: params.roomId, meetingRoomName, ended: true, participantCount: 0 };
  }

  async endCall(params: { roomId: string; endedByUserId: string }) {
    const client = this.getClient();
    const metadataKey = this.metadataKey(params.roomId);
    const participantsKey = this.participantsKey(params.roomId);
    const meetingRoomName = await client.hget(metadataKey, 'meetingRoomName');
    const participantUserIds = await client.smembers(participantsKey);

    const pipeline = client.multi().del(metadataKey).del(participantsKey);
    for (const userId of participantUserIds) {
      pipeline.srem(this.userRoomsKey(userId), params.roomId);
    }
    pipeline.srem(this.userRoomsKey(params.endedByUserId), params.roomId);
    await pipeline.exec();

    return {
      roomId: params.roomId,
      meetingRoomName,
      endedByUserId: params.endedByUserId,
      endedAt: new Date().toISOString(),
    };
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