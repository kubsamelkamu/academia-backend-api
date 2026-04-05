import { ChatCallPresenceService } from '../../src/modules/chat/chat-call-presence.service';

type RedisHash = Map<string, string>;

class FakeRedis {
  private readonly hashes = new Map<string, RedisHash>();
  private readonly sets = new Map<string, Set<string>>();
  private readonly expirations = new Map<string, number>();

  async watch(..._keys: string[]) {
    return 'OK';
  }

  async unwatch() {
    return 'OK';
  }

  on(_event: string, _listener: (...args: unknown[]) => void) {
    return this;
  }

  async quit() {
    return 'OK';
  }

  async hget(key: string, field: string) {
    return this.hashes.get(key)?.get(field) ?? null;
  }

  async hgetall(key: string) {
    const hash = this.hashes.get(key);
    if (!hash) return {};
    return Object.fromEntries(hash.entries());
  }

  async smembers(key: string) {
    return Array.from(this.sets.get(key) ?? []);
  }

  async scard(key: string) {
    return this.sets.get(key)?.size ?? 0;
  }

  async sismember(key: string, value: string) {
    return this.sets.get(key)?.has(value) ? 1 : 0;
  }

  multi() {
    const ops: Array<() => void> = [];

    const pipeline = {
      hset: (key: string, data: Record<string, string>) => {
        ops.push(() => {
          const hash = this.hashes.get(key) ?? new Map<string, string>();
          for (const [field, value] of Object.entries(data)) {
            hash.set(field, value);
          }
          this.hashes.set(key, hash);
        });
        return pipeline;
      },
      sadd: (key: string, value: string) => {
        ops.push(() => {
          const set = this.sets.get(key) ?? new Set<string>();
          set.add(value);
          this.sets.set(key, set);
        });
        return pipeline;
      },
      srem: (key: string, value: string) => {
        ops.push(() => {
          const set = this.sets.get(key);
          if (!set) return;
          set.delete(value);
          if (set.size === 0) {
            this.sets.delete(key);
          }
        });
        return pipeline;
      },
      del: (key: string) => {
        ops.push(() => {
          this.hashes.delete(key);
          this.sets.delete(key);
          this.expirations.delete(key);
        });
        return pipeline;
      },
      expire: (key: string, ttlSeconds: number) => {
        ops.push(() => {
          this.expirations.set(key, ttlSeconds);
        });
        return pipeline;
      },
      exec: async () => {
        for (const op of ops) {
          op();
        }
        return ops.map(() => [null, 'OK']);
      },
    };

    return pipeline;
  }
}

jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => new FakeRedis()),
}));

describe('ChatCallPresenceService', () => {
  let service: ChatCallPresenceService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.REDIS_URL = 'redis://localhost:6379';
    service = new ChatCallPresenceService();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
    delete process.env.REDIS_URL;
  });

  it('startCall creates active state and participant set with caller', async () => {
    const result = await service.startCall({
      roomId: 'room-1',
      projectGroupId: 'group-1',
      meetingRoomName: 'meeting-1',
      userId: 'user-1',
    });

    expect(result.roomId).toBe('room-1');
    expect(result.meetingRoomName).toBe('meeting-1');
    expect(result.startedByUserId).toBe('user-1');
    expect(result.sessionCreated).toBe(true);
    expect(result.participantCount).toBe(1);

    const joinResult = await service.joinCall({ roomId: 'room-1', userId: 'user-2' });
    expect(joinResult.active).toBe(true);
    expect(joinResult.participantCount).toBe(2);
  });

  it('duplicate startCall by same user does not double-count participants', async () => {
    const first = await service.startCall({
      roomId: 'room-1',
      projectGroupId: 'group-1',
      meetingRoomName: 'meeting-1',
      userId: 'user-1',
    });

    const second = await service.startCall({
      roomId: 'room-1',
      projectGroupId: 'group-1',
      meetingRoomName: 'meeting-2',
      userId: 'user-1',
    });

    expect(first.participantCount).toBe(1);
    expect(second.participantCount).toBe(1);
    expect(second.startedAt).toBe(first.startedAt);
    expect(second.meetingRoomName).toBe(first.meetingRoomName);
    expect(second.sessionCreated).toBe(false);
  });

  it('joinCall is idempotent for existing participant', async () => {
    await service.startCall({
      roomId: 'room-1',
      projectGroupId: 'group-1',
      meetingRoomName: 'meeting-1',
      userId: 'user-1',
    });

    const firstJoin = await service.joinCall({ roomId: 'room-1', userId: 'user-1' });
    const secondJoin = await service.joinCall({ roomId: 'room-1', userId: 'user-1' });

    expect(firstJoin.active).toBe(true);
    expect(secondJoin.active).toBe(true);
    expect(firstJoin.participantCount).toBe(1);
    expect(secondJoin.participantCount).toBe(1);
    expect(firstJoin.meetingRoomName).toBe('meeting-1');
    expect(secondJoin.meetingRoomName).toBe('meeting-1');
  });

  it('leaveCall decrements count and ends when last participant leaves', async () => {
    await service.startCall({
      roomId: 'room-1',
      projectGroupId: 'group-1',
      meetingRoomName: 'meeting-1',
      userId: 'user-1',
    });
    await service.joinCall({ roomId: 'room-1', userId: 'user-2' });

    const firstLeave = await service.leaveCall({ roomId: 'room-1', userId: 'user-2' });
    expect(firstLeave.ended).toBe(false);
    expect(firstLeave.meetingRoomName).toBe('meeting-1');
    expect(firstLeave.participantCount).toBe(1);

    const lastLeave = await service.leaveCall({ roomId: 'room-1', userId: 'user-1' });
    expect(lastLeave.ended).toBe(true);
    expect(lastLeave.meetingRoomName).toBe('meeting-1');
    expect(lastLeave.participantCount).toBe(0);

    const joinAfterEnd = await service.joinCall({ roomId: 'room-1', userId: 'user-3' });
    expect(joinAfterEnd.active).toBe(false);
    expect(joinAfterEnd.participantCount).toBe(0);
  });

  it('endCall clears keys and keeps idempotent semantics', async () => {
    await service.startCall({
      roomId: 'room-1',
      projectGroupId: 'group-1',
      meetingRoomName: 'meeting-1',
      userId: 'user-1',
    });
    await service.joinCall({ roomId: 'room-1', userId: 'user-2' });

    const ended = await service.endCall({ roomId: 'room-1', endedByUserId: 'user-1' });
    expect(ended.roomId).toBe('room-1');
    expect(ended.meetingRoomName).toBe('meeting-1');
    expect(ended.endedByUserId).toBe('user-1');

    const joinAfterEnd = await service.joinCall({ roomId: 'room-1', userId: 'user-2' });
    expect(joinAfterEnd.active).toBe(false);

    const secondEnd = await service.endCall({ roomId: 'room-1', endedByUserId: 'user-1' });
    expect(secondEnd.roomId).toBe('room-1');
  });

  it('throws REDIS_NOT_CONFIGURED when REDIS_URL is missing', async () => {
    delete process.env.REDIS_URL;
    const unconfiguredService = new ChatCallPresenceService();

    await expect(
      unconfiguredService.startCall({
        roomId: 'room-1',
        projectGroupId: 'group-1',
        meetingRoomName: 'meeting-1',
        userId: 'user-1',
      })
    ).rejects.toThrow('REDIS_NOT_CONFIGURED');
  });
});
