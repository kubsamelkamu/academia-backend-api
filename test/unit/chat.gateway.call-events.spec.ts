import { ChatGateway } from '../../src/modules/chat/chat.gateway';

describe('ChatGateway call events', () => {
  const jwtService: any = {
    verify: jest.fn(),
  };

  const chatService: any = {
    assertUserCanAccessChatRoomCall: jest.fn(),
    assertUserCanForceEndChatCall: jest.fn(),
  };

  const chatCallPresenceService: any = {
    startCall: jest.fn(),
    joinCall: jest.fn(),
    leaveCall: jest.fn(),
    endCall: jest.fn(),
    getActiveCallSession: jest.fn(),
  };

  const emit = jest.fn();
  const to = jest.fn(() => ({ emit }));

  let gateway: ChatGateway;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.CHAT_VIDEO_PRESENCE_ENABLED = 'true';
    to.mockReturnValue({ emit });

    gateway = new ChatGateway(jwtService, chatService, chatCallPresenceService);
    gateway.server = { to } as any;
  });

  afterEach(() => {
    delete process.env.CHAT_VIDEO_PRESENCE_ENABLED;
  });

  it('emits call:started on a new call session and uses canonical projectGroupId', async () => {
    chatService.assertUserCanAccessChatRoomCall.mockResolvedValue({
      dbUser: { id: 'user-1' },
      projectGroupId: 'group-canonical',
    });
    chatCallPresenceService.startCall.mockResolvedValue({
      roomId: 'room-1',
      meetingRoomName: 'meeting-1',
      startedByUserId: 'user-1',
      startedAt: '2026-04-05T10:00:00.000Z',
      sessionCreated: true,
      participantCount: 1,
    });

    const result = await gateway.handleCallStart(
      { userId: 'user-1', tenantId: 'tenant-1', roles: ['STUDENT'] } as any,
      {
        roomId: 'room-1',
        projectGroupId: 'group-from-client',
        meetingRoomName: 'meeting-1',
      }
    );

    expect(chatService.assertUserCanAccessChatRoomCall).toHaveBeenCalledWith({
      user: { sub: 'user-1', tenantId: 'tenant-1', roles: ['STUDENT'] },
      roomId: 'room-1',
      projectGroupId: 'group-from-client',
    });
    expect(chatCallPresenceService.startCall).toHaveBeenCalledWith({
      roomId: 'room-1',
      projectGroupId: 'group-canonical',
      meetingRoomName: 'meeting-1',
      userId: 'user-1',
    });
    expect(to).toHaveBeenCalledWith('chat_room_room-1');
    expect(emit).toHaveBeenCalledWith('call:started', {
      roomId: 'room-1',
      meetingRoomName: 'meeting-1',
      startedByUserId: 'user-1',
      startedAt: '2026-04-05T10:00:00.000Z',
      participantCount: 1,
    });
    expect(result).toEqual({
      ok: true,
      data: {
        roomId: 'room-1',
        meetingRoomName: 'meeting-1',
        participantCount: 1,
      },
    });
  });

  it('emits call:participantChanged when call:start reuses an active session', async () => {
    chatService.assertUserCanAccessChatRoomCall.mockResolvedValue({
      dbUser: { id: 'user-2' },
      projectGroupId: 'group-1',
    });
    chatCallPresenceService.startCall.mockResolvedValue({
      roomId: 'room-1',
      meetingRoomName: 'meeting-1',
      startedByUserId: 'user-1',
      startedAt: '2026-04-05T10:00:00.000Z',
      sessionCreated: false,
      participantCount: 2,
    });

    const result = await gateway.handleCallStart(
      { userId: 'user-2', tenantId: 'tenant-1', roles: ['ADVISOR'] } as any,
      {
        roomId: 'room-1',
        projectGroupId: 'group-1',
        meetingRoomName: 'meeting-1',
      }
    );

    expect(emit).toHaveBeenCalledWith('call:participantChanged', {
      roomId: 'room-1',
      meetingRoomName: 'meeting-1',
      participantCount: 2,
    });
    expect(result).toEqual({
      ok: true,
      data: {
        roomId: 'room-1',
        meetingRoomName: 'meeting-1',
        participantCount: 2,
      },
    });
  });

  it('maps roomId and projectGroupId mismatch to FORBIDDEN on call:join', async () => {
    chatService.assertUserCanAccessChatRoomCall.mockRejectedValue(
      new Error('roomId and projectGroupId mismatch')
    );

    const result = await gateway.handleCallJoin(
      { userId: 'user-1', tenantId: 'tenant-1', roles: ['STUDENT'] } as any,
      {
        roomId: 'room-1',
        projectGroupId: 'wrong-group',
      }
    );

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'FORBIDDEN',
        message: 'roomId and projectGroupId mismatch',
      },
    });
  });

  it('uses force-end authorization for active sessions and emits call:ended', async () => {
    chatCallPresenceService.getActiveCallSession.mockResolvedValue({
      roomId: 'room-1',
      meetingRoomName: 'meeting-1',
      startedByUserId: 'user-1',
      startedAt: '2026-04-05T10:00:00.000Z',
      active: true,
    });
    chatService.assertUserCanForceEndChatCall.mockResolvedValue({
      dbUser: { id: 'advisor-1' },
    });
    chatCallPresenceService.endCall.mockResolvedValue({
      roomId: 'room-1',
      meetingRoomName: 'meeting-1',
      endedByUserId: 'advisor-1',
      endedAt: '2026-04-05T10:05:00.000Z',
    });

    const result = await gateway.handleCallEnd(
      { userId: 'advisor-1', tenantId: 'tenant-1', roles: ['ADVISOR'] } as any,
      {
        roomId: 'room-1',
        projectGroupId: 'group-1',
        meetingRoomName: 'meeting-1',
      }
    );

    expect(chatService.assertUserCanForceEndChatCall).toHaveBeenCalledWith({
      user: { sub: 'advisor-1', tenantId: 'tenant-1', roles: ['ADVISOR'] },
      roomId: 'room-1',
      projectGroupId: 'group-1',
      startedByUserId: 'user-1',
    });
    expect(chatService.assertUserCanAccessChatRoomCall).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith('call:ended', {
      roomId: 'room-1',
      meetingRoomName: 'meeting-1',
      endedByUserId: 'advisor-1',
      endedAt: '2026-04-05T10:05:00.000Z',
    });
    expect(result).toEqual({
      ok: true,
      data: {
        roomId: 'room-1',
        meetingRoomName: 'meeting-1',
        participantCount: 0,
      },
    });
  });

  it('returns FORBIDDEN when force-end permission is denied', async () => {
    chatCallPresenceService.getActiveCallSession.mockResolvedValue({
      roomId: 'room-1',
      meetingRoomName: 'meeting-1',
      startedByUserId: 'user-1',
      startedAt: '2026-04-05T10:00:00.000Z',
      active: true,
    });
    chatService.assertUserCanForceEndChatCall.mockRejectedValue(new Error('CALL_END_FORBIDDEN'));

    const result = await gateway.handleCallEnd(
      { userId: 'student-2', tenantId: 'tenant-1', roles: ['STUDENT'] } as any,
      {
        roomId: 'room-1',
        projectGroupId: 'group-1',
      }
    );

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Only the call starter, assigned advisor or group leader can end this call',
      },
    });
  });
});
