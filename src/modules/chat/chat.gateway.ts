import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';

import { ChatService } from './chat.service';
import { ChatCallPresenceService } from './chat-call-presence.service';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  tenantId?: string;
  roles?: string[];
}

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void
    ) => {
      const normalizeOrigin = (value: string) => value.replace(/\/+$/, '');

      const allowedOrigins = new Set(
        [
          process.env.FRONTEND_URL,
          process.env.APP_URL,
          'http://localhost:3000',
          'http://localhost:3001',
          'http://localhost:3002',
          'https://academia.et',
          'https://www.academia.et',
          'https://academia-admin-platform.vercel.app',
          'https://admin.academia.et',
          'https://api.academia.et',
          'https://academiac-api-faabc5c910c9.herokuapp.com',
        ]
          .filter(Boolean)
          .map((value) => normalizeOrigin(String(value)))
      );

      if (!origin) return callback(null, true);
      if (allowedOrigins.has(normalizeOrigin(origin))) return callback(null, true);
      return callback(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    credentials: true,
  },
})
@Injectable()
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  private readonly roomUserSocketCounts = new Map<string, Map<string, number>>();
  private readonly socketRooms = new Map<string, Set<string>>();

  private readonly roomUserTypingCounts = new Map<string, Map<string, number>>();
  private readonly socketTypingRooms = new Map<string, Set<string>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly chatService: ChatService,
    private readonly chatCallPresenceService: ChatCallPresenceService
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = client.handshake.auth.token || (client.handshake.query.token as string);

      if (!token) {
        this.logger.warn(`Connection rejected: No token provided`);
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      client.userId = payload.sub;
      client.tenantId = payload.tenantId;
      client.roles = Array.isArray(payload.roles) ? payload.roles : undefined;

      this.logger.log(`Client connected: ${client.id} (User: ${client.userId})`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Connection failed: ${message}`);
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    this.handleTypingDisconnect(client);
    this.handlePresenceDisconnect(client);
    await this.handleCallPresenceDisconnect(client);
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  private isVideoPresenceEnabled() {
    const value = String(
      process.env.CHAT_VIDEO_PRESENCE_ENABLED ??
        process.env['chat.video.presence.enabled'] ??
        'false'
    ).toLowerCase();
    return value === '1' || value === 'true' || value === 'yes';
  }

  private ensureVideoPresenceEnabled() {
    if (!this.isVideoPresenceEnabled()) {
      throw new Error('FEATURE_DISABLED');
    }
  }

  private async handleCallPresenceDisconnect(client: AuthenticatedSocket) {
    if (!client.userId) return;
    try {
      const results = await this.chatCallPresenceService.leaveAllCallsForUser(client.userId);
      for (const result of results) {
        if (result.ended) {
          this.server.to(`chat_room_${result.roomId}`).emit('call:ended', {
            roomId: result.roomId,
            meetingRoomName: result.meetingRoomName,
            endedByUserId: client.userId,
            endedAt: new Date().toISOString(),
          });
        } else {
          this.server.to(`chat_room_${result.roomId}`).emit('call:participantChanged', {
            roomId: result.roomId,
            meetingRoomName: result.meetingRoomName,
            participantCount: result.participantCount,
          });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Call presence disconnect cleanup failed: ${message}`);
    }
  }
  private static readonly MAX_MEETING_ROOM_NAME_LENGTH = 128;
  private static readonly MEETING_ROOM_NAME_PATTERN = /^[A-Za-z0-9_-]+$/;

  private mapCallError(err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'UNAUTHORIZED') {
      return { code: 'UNAUTHORIZED', message: 'Unauthorized' };
    }
    if (message === 'FEATURE_DISABLED') {
      return { code: 'FORBIDDEN', message: 'Video call presence is disabled' };
    }
    if (message === 'REDIS_NOT_CONFIGURED') {
      return { code: 'INTERNAL_ERROR', message: 'Video call presence is not configured' };
    }
    if (message === 'CALL_NOT_ACTIVE') {
      return { code: 'ROOM_NOT_FOUND', message: 'No active call for room' };
    }
    if (message === 'MEETING_ROOM_MISMATCH') {
      return { code: 'FORBIDDEN', message: 'meetingRoomName mismatch with active call session' };
    }
    if (message === 'MEETING_ROOM_REQUIRED') {
      return { code: 'VALIDATION_ERROR', message: 'meetingRoomName is required' };
    }
    if (message === 'MEETING_ROOM_INVALID') {
      return {
        code: 'VALIDATION_ERROR',
        message:
          'meetingRoomName must be 1-128 characters and contain only letters, numbers, underscores or hyphens',
      };
    }
    if (message === 'CALL_END_FORBIDDEN') {
      return {
        code: 'FORBIDDEN',
        message: 'Only the call starter, assigned advisor or group leader can end this call',
      };
    }
    if (message.includes('not found')) {
      return { code: 'ROOM_NOT_FOUND', message };
    }
    if (
      message.includes('required') ||
      message.includes('approved') ||
      message.includes('member') ||
      message.includes('mismatch')
    ) {
      return { code: 'FORBIDDEN', message };
    }
    return { code: 'INTERNAL_ERROR', message: 'Internal server error' };
  }

  private getOrCreateRoomCounts(roomId: string) {
    let counts = this.roomUserSocketCounts.get(roomId);
    if (!counts) {
      counts = new Map<string, number>();
      this.roomUserSocketCounts.set(roomId, counts);
    }
    return counts;
  }

  private getOnlineUserIds(roomId: string) {
    const counts = this.roomUserSocketCounts.get(roomId);
    if (!counts) return [];
    return Array.from(counts.entries())
      .filter(([, count]) => count > 0)
      .map(([userId]) => userId);
  }

  private emitPresenceUpdate(roomId: string) {
    const onlineUserIds = this.getOnlineUserIds(roomId);
    this.server.to(`chat_room_${roomId}`).emit('presence:update', { roomId, onlineUserIds });
  }

  private trackPresenceJoin(client: AuthenticatedSocket, roomId: string) {
    if (!client.userId) return;

    const rooms = this.socketRooms.get(client.id) ?? new Set<string>();
    rooms.add(roomId);
    this.socketRooms.set(client.id, rooms);

    const counts = this.getOrCreateRoomCounts(roomId);
    const current = counts.get(client.userId) ?? 0;
    counts.set(client.userId, current + 1);

    this.emitPresenceUpdate(roomId);
  }

  private handlePresenceDisconnect(client: AuthenticatedSocket) {
    if (!client.userId) return;
    const rooms = this.socketRooms.get(client.id);
    if (!rooms?.size) return;

    for (const roomId of rooms) {
      const counts = this.roomUserSocketCounts.get(roomId);
      if (!counts) continue;
      const current = counts.get(client.userId) ?? 0;
      const next = Math.max(0, current - 1);
      if (next === 0) counts.delete(client.userId);
      else counts.set(client.userId, next);

      if (counts.size === 0) this.roomUserSocketCounts.delete(roomId);
      this.emitPresenceUpdate(roomId);
    }

    this.socketRooms.delete(client.id);
  }

  private getOrCreateTypingCounts(roomId: string) {
    let counts = this.roomUserTypingCounts.get(roomId);
    if (!counts) {
      counts = new Map<string, number>();
      this.roomUserTypingCounts.set(roomId, counts);
    }
    return counts;
  }

  private emitTypingUpdate(
    roomId: string,
    payload: { roomId: string; userId: string; isTyping: boolean; at: Date }
  ) {
    this.server.to(`chat_room_${roomId}`).emit('typing:update', payload);
  }

  private markSocketTypingRoom(socketId: string, roomId: string) {
    const rooms = this.socketTypingRooms.get(socketId) ?? new Set<string>();
    rooms.add(roomId);
    this.socketTypingRooms.set(socketId, rooms);
  }

  private unmarkSocketTypingRoom(socketId: string, roomId: string) {
    const rooms = this.socketTypingRooms.get(socketId);
    if (!rooms) return;
    rooms.delete(roomId);
    if (!rooms.size) this.socketTypingRooms.delete(socketId);
  }

  private handleTypingDisconnect(client: AuthenticatedSocket) {
    if (!client.userId) return;
    const rooms = this.socketTypingRooms.get(client.id);
    if (!rooms?.size) return;

    for (const roomId of rooms) {
      const counts = this.roomUserTypingCounts.get(roomId);
      if (!counts) continue;
      const current = counts.get(client.userId) ?? 0;
      const next = Math.max(0, current - 1);
      if (next === 0) {
        counts.delete(client.userId);
        this.emitTypingUpdate(roomId, {
          roomId,
          userId: client.userId,
          isTyping: false,
          at: new Date(),
        });
      } else {
        counts.set(client.userId, next);
      }

      if (counts.size === 0) this.roomUserTypingCounts.delete(roomId);
    }

    this.socketTypingRooms.delete(client.id);
  }

  private requireSocketUser(client: AuthenticatedSocket) {
    if (!client.userId) {
      throw new Error('UNAUTHORIZED');
    }
  }

  private normalizeMeetingRoomName(value: unknown, required: boolean = false) {
    const meetingRoomName = String(value ?? '').trim();

    if (!meetingRoomName) {
      if (required) {
        throw new Error('MEETING_ROOM_REQUIRED');
      }
      return '';
    }

    if (meetingRoomName.length > ChatGateway.MAX_MEETING_ROOM_NAME_LENGTH) {
      throw new Error('MEETING_ROOM_INVALID');
    }

    if (!ChatGateway.MEETING_ROOM_NAME_PATTERN.test(meetingRoomName)) {
      throw new Error('MEETING_ROOM_INVALID');
    }

    return meetingRoomName;
  }

  private async getValidatedActiveMeetingRoomName(
    roomId: string,
    providedMeetingRoomName?: string
  ) {
    const session = await this.chatCallPresenceService.getActiveCallSession(roomId);
    if (!session || !session.meetingRoomName) {
      throw new Error('CALL_NOT_ACTIVE');
    }

    if (providedMeetingRoomName && providedMeetingRoomName !== session.meetingRoomName) {
      throw new Error('MEETING_ROOM_MISMATCH');
    }

    return session.meetingRoomName;
  }

  @SubscribeMessage('chat:join')
  async handleJoin(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { projectGroupId?: string }
  ) {
    try {
      this.requireSocketUser(client);
      const projectGroupId = String(body?.projectGroupId ?? '').trim();
      if (!projectGroupId) {
        return { ok: false, error: { code: 'BAD_REQUEST', message: 'projectGroupId is required' } };
      }

      const result = await this.chatService.joinApprovedProjectGroupChat(
        {
          sub: client.userId,
          tenantId: client.tenantId,
          roles: client.roles ?? [],
        },
        projectGroupId
      );

      client.join(`chat_room_${result.roomId}`);
      this.trackPresenceJoin(client, result.roomId);
      return { ok: true, data: { ...result, onlineUserIds: this.getOnlineUserIds(result.roomId) } };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: { code: 'JOIN_FAILED', message } };
    }
  }

  @SubscribeMessage('presence:get')
  async handlePresenceGet(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { roomId?: string }
  ) {
    try {
      this.requireSocketUser(client);
      const roomId = String(body?.roomId ?? '').trim();
      if (!roomId) {
        return { ok: false, error: { code: 'BAD_REQUEST', message: 'roomId is required' } };
      }

      // Authorize access to this room
      await this.chatService.requireRoomAndMembership(
        { sub: client.userId, tenantId: client.tenantId, roles: client.roles ?? [] },
        roomId
      );

      return { ok: true, data: { roomId, onlineUserIds: this.getOnlineUserIds(roomId) } };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: { code: 'PRESENCE_FAILED', message } };
    }
  }

  @SubscribeMessage('typing:start')
  async handleTypingStart(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { roomId?: string }
  ) {
    try {
      this.requireSocketUser(client);
      const roomId = String(body?.roomId ?? '').trim();
      if (!roomId) {
        return { ok: false, error: { code: 'BAD_REQUEST', message: 'roomId is required' } };
      }

      await this.chatService.requireRoomAndMembership(
        { sub: client.userId, tenantId: client.tenantId, roles: client.roles ?? [] },
        roomId
      );

      const counts = this.getOrCreateTypingCounts(roomId);
      const current = counts.get(client.userId!) ?? 0;
      counts.set(client.userId!, current + 1);
      this.markSocketTypingRoom(client.id, roomId);

      // Broadcast only on transition 0 -> 1
      if (current === 0) {
        this.emitTypingUpdate(roomId, {
          roomId,
          userId: client.userId!,
          isTyping: true,
          at: new Date(),
        });
      }

      return { ok: true, data: { roomId } };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: { code: 'TYPING_FAILED', message } };
    }
  }

  @SubscribeMessage('call:start')
  async handleCallStart(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    body: { roomId?: string; projectGroupId?: string; meetingRoomName?: string; at?: string }
  ) {
    try {
      this.requireSocketUser(client);
      this.ensureVideoPresenceEnabled();

      const roomId = String(body?.roomId ?? '').trim();
      const projectGroupId = String(body?.projectGroupId ?? '').trim();
      const meetingRoomName = this.normalizeMeetingRoomName(body?.meetingRoomName, true);
      if (!roomId || !projectGroupId) {
        return {
          ok: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'roomId, projectGroupId and meetingRoomName are required',
          },
        };
      }

      const { dbUser, projectGroupId: canonicalProjectGroupId } =
        await this.chatService.assertUserCanAccessChatRoomCall({
          user: { sub: client.userId, tenantId: client.tenantId, roles: client.roles ?? [] },
          roomId,
          projectGroupId,
        });

      const state = await this.chatCallPresenceService.startCall({
        roomId,
        projectGroupId: canonicalProjectGroupId,
        meetingRoomName,
        userId: dbUser.id,
      });

      if (state.sessionCreated) {
        this.server.to(`chat_room_${roomId}`).emit('call:started', {
          roomId,
          meetingRoomName: state.meetingRoomName,
          startedByUserId: state.startedByUserId,
          startedAt: state.startedAt,
          participantCount: state.participantCount,
        });
      } else {
        this.server.to(`chat_room_${roomId}`).emit('call:participantChanged', {
          roomId,
          meetingRoomName: state.meetingRoomName,
          participantCount: state.participantCount,
        });
      }

      return {
        ok: true,
        data: {
          roomId,
          meetingRoomName: state.meetingRoomName,
          participantCount: state.participantCount,
        },
      };
    } catch (err) {
      return { ok: false, error: this.mapCallError(err) };
    }
  }

  @SubscribeMessage('call:join')
  async handleCallJoin(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    body: { roomId?: string; projectGroupId?: string; meetingRoomName?: string; at?: string }
  ) {
    try {
      this.requireSocketUser(client);
      this.ensureVideoPresenceEnabled();

      const roomId = String(body?.roomId ?? '').trim();
      const projectGroupId = String(body?.projectGroupId ?? '').trim();
      const meetingRoomName = this.normalizeMeetingRoomName(body?.meetingRoomName);
      if (!roomId) {
        return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'roomId is required' } };
      }

      const { dbUser } = await this.chatService.assertUserCanAccessChatRoomCall({
        user: { sub: client.userId, tenantId: client.tenantId, roles: client.roles ?? [] },
        roomId,
        projectGroupId,
      });

      const sessionMeetingRoomName = await this.getValidatedActiveMeetingRoomName(
        roomId,
        meetingRoomName || undefined
      );

      const result = await this.chatCallPresenceService.joinCall({ roomId, userId: dbUser.id });
      if (!result.active) {
        return { ok: false, error: { code: 'ROOM_NOT_FOUND', message: 'No active call for room' } };
      }

      this.server.to(`chat_room_${roomId}`).emit('call:participantChanged', {
        roomId,
        meetingRoomName: sessionMeetingRoomName,
        participantCount: result.participantCount,
      });

      return {
        ok: true,
        data: {
          roomId,
          meetingRoomName: sessionMeetingRoomName,
          participantCount: result.participantCount,
        },
      };
    } catch (err) {
      return { ok: false, error: this.mapCallError(err) };
    }
  }

  @SubscribeMessage('call:leave')
  async handleCallLeave(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    body: { roomId?: string; projectGroupId?: string; meetingRoomName?: string; at?: string }
  ) {
    try {
      this.requireSocketUser(client);
      this.ensureVideoPresenceEnabled();

      const roomId = String(body?.roomId ?? '').trim();
      const projectGroupId = String(body?.projectGroupId ?? '').trim();
      const meetingRoomName = this.normalizeMeetingRoomName(body?.meetingRoomName);
      if (!roomId) {
        return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'roomId is required' } };
      }

      const { dbUser } = await this.chatService.assertUserCanAccessChatRoomCall({
        user: { sub: client.userId, tenantId: client.tenantId, roles: client.roles ?? [] },
        roomId,
        projectGroupId,
      });

      const sessionMeetingRoomName = await this.getValidatedActiveMeetingRoomName(
        roomId,
        meetingRoomName || undefined
      );

      const result = await this.chatCallPresenceService.leaveCall({ roomId, userId: dbUser.id });

      if (result.ended) {
        this.server.to(`chat_room_${roomId}`).emit('call:ended', {
          roomId,
          meetingRoomName: sessionMeetingRoomName,
          endedByUserId: dbUser.id,
          endedAt: new Date().toISOString(),
        });
      } else {
        this.server.to(`chat_room_${roomId}`).emit('call:participantChanged', {
          roomId,
          meetingRoomName: sessionMeetingRoomName,
          participantCount: result.participantCount,
        });
      }

      return {
        ok: true,
        data: {
          roomId,
          meetingRoomName: sessionMeetingRoomName,
          participantCount: result.participantCount,
        },
      };
    } catch (err) {
      return { ok: false, error: this.mapCallError(err) };
    }
  }

  @SubscribeMessage('call:end')
  async handleCallEnd(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    body: { roomId?: string; projectGroupId?: string; meetingRoomName?: string; at?: string }
  ) {
    try {
      this.requireSocketUser(client);
      this.ensureVideoPresenceEnabled();

      const roomId = String(body?.roomId ?? '').trim();
      const projectGroupId = String(body?.projectGroupId ?? '').trim();
      const meetingRoomName = this.normalizeMeetingRoomName(body?.meetingRoomName);
      if (!roomId) {
        return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'roomId is required' } };
      }

      const activeSession = await this.chatCallPresenceService.getActiveCallSession(roomId);
      const gatewayUser = {
        sub: client.userId,
        tenantId: client.tenantId,
        roles: client.roles ?? [],
      };

      const { dbUser } = activeSession?.startedByUserId
        ? await this.chatService.assertUserCanForceEndChatCall({
            user: gatewayUser,
            roomId,
            projectGroupId,
            startedByUserId: activeSession.startedByUserId,
          })
        : await this.chatService.assertUserCanAccessChatRoomCall({
            user: gatewayUser,
            roomId,
            projectGroupId,
          });

      if (
        meetingRoomName &&
        activeSession?.meetingRoomName &&
        meetingRoomName !== activeSession.meetingRoomName
      ) {
        return {
          ok: false,
          error: {
            code: 'FORBIDDEN',
            message: 'meetingRoomName mismatch with active call session',
          },
        };
      }

      const effectiveMeetingRoomName = activeSession?.meetingRoomName ?? (meetingRoomName || null);

      const payload = await this.chatCallPresenceService.endCall({
        roomId,
        endedByUserId: dbUser.id,
      });

      this.server.to(`chat_room_${roomId}`).emit('call:ended', {
        ...payload,
        meetingRoomName: payload.meetingRoomName ?? effectiveMeetingRoomName,
      });

      return {
        ok: true,
        data: {
          roomId,
          meetingRoomName: payload.meetingRoomName ?? effectiveMeetingRoomName,
          participantCount: 0,
        },
      };
    } catch (err) {
      return { ok: false, error: this.mapCallError(err) };
    }
  }

  @SubscribeMessage('typing:stop')
  async handleTypingStop(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { roomId?: string }
  ) {
    try {
      this.requireSocketUser(client);
      const roomId = String(body?.roomId ?? '').trim();
      if (!roomId) {
        return { ok: false, error: { code: 'BAD_REQUEST', message: 'roomId is required' } };
      }

      await this.chatService.requireRoomAndMembership(
        { sub: client.userId, tenantId: client.tenantId, roles: client.roles ?? [] },
        roomId
      );

      const counts = this.roomUserTypingCounts.get(roomId);
      const current = counts?.get(client.userId!) ?? 0;

      if (counts && current > 0) {
        const next = Math.max(0, current - 1);
        if (next === 0) {
          counts.delete(client.userId!);
          this.emitTypingUpdate(roomId, {
            roomId,
            userId: client.userId!,
            isTyping: false,
            at: new Date(),
          });
        } else {
          counts.set(client.userId!, next);
        }

        if (counts.size === 0) this.roomUserTypingCounts.delete(roomId);
      }

      this.unmarkSocketTypingRoom(client.id, roomId);
      return { ok: true, data: { roomId } };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: { code: 'TYPING_FAILED', message } };
    }
  }

  @SubscribeMessage('message:send')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    body: {
      roomId?: string;
      clientMessageId?: string;
      text?: string;
      replyToMessageId?: string;
      attachment?: {
        kind?: 'FILE';
        url?: string;
        publicId?: string;
        resourceType?: 'image' | 'raw';
        name?: string;
        mimeType?: string;
        size?: number;
      };
    }
  ) {
    try {
      this.requireSocketUser(client);
      const roomId = String(body?.roomId ?? '').trim();
      if (!roomId) {
        return { ok: false, error: { code: 'BAD_REQUEST', message: 'roomId is required' } };
      }

      const message = await this.chatService.sendMessage(
        {
          sub: client.userId,
          tenantId: client.tenantId,
          roles: client.roles ?? [],
        },
        {
          roomId,
          text: body?.text,
          replyToMessageId: body?.replyToMessageId,
          attachment:
            body?.attachment?.url && body?.attachment?.publicId
              ? {
                  url: body.attachment.url,
                  publicId: body.attachment.publicId,
                  resourceType: body.attachment.resourceType ?? 'raw',
                  name: body.attachment.name,
                  mimeType: body.attachment.mimeType,
                  size: body.attachment.size,
                }
              : null,
        }
      );

      const payload = {
        roomId,
        clientMessageId: body?.clientMessageId ?? null,
        message,
        deliveredAt: message.createdAt,
      };

      this.server.to(`chat_room_${roomId}`).emit('message:new', payload);
      return { ok: true, data: payload };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: { code: 'SEND_FAILED', message } };
    }
  }

  @SubscribeMessage('message:edit')
  async handleEditMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { roomId?: string; messageId?: string; text?: string }
  ) {
    try {
      this.requireSocketUser(client);
      const roomId = String(body?.roomId ?? '').trim();
      const messageId = String(body?.messageId ?? '').trim();
      if (!roomId || !messageId) {
        return {
          ok: false,
          error: { code: 'BAD_REQUEST', message: 'roomId and messageId are required' },
        };
      }

      const updated = await this.chatService.editMessage(
        { sub: client.userId, tenantId: client.tenantId, roles: client.roles ?? [] },
        { roomId, messageId, text: String(body?.text ?? '') }
      );

      const payload = { roomId, messageId, message: updated };
      this.server.to(`chat_room_${roomId}`).emit('message:edited', payload);
      return { ok: true, data: payload };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: { code: 'EDIT_FAILED', message } };
    }
  }

  @SubscribeMessage('message:delete')
  async handleDeleteMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { roomId?: string; messageId?: string }
  ) {
    try {
      this.requireSocketUser(client);
      const roomId = String(body?.roomId ?? '').trim();
      const messageId = String(body?.messageId ?? '').trim();
      if (!roomId || !messageId) {
        return {
          ok: false,
          error: { code: 'BAD_REQUEST', message: 'roomId and messageId are required' },
        };
      }

      await this.chatService.deleteMessage(
        { sub: client.userId, tenantId: client.tenantId, roles: client.roles ?? [] },
        { roomId, messageId }
      );

      const payload = { roomId, messageId };
      this.server.to(`chat_room_${roomId}`).emit('message:deleted', payload);
      return { ok: true, data: payload };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: { code: 'DELETE_FAILED', message } };
    }
  }

  @SubscribeMessage('reaction:set')
  async handleReactionSet(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { roomId?: string; messageId?: string; emoji?: string }
  ) {
    try {
      this.requireSocketUser(client);
      const roomId = String(body?.roomId ?? '').trim();
      const messageId = String(body?.messageId ?? '').trim();
      const emoji = String(body?.emoji ?? '').trim();
      if (!roomId || !messageId || !emoji) {
        return {
          ok: false,
          error: { code: 'BAD_REQUEST', message: 'roomId, messageId and emoji are required' },
        };
      }

      const result = await this.chatService.setReaction(
        { sub: client.userId, tenantId: client.tenantId, roles: client.roles ?? [] },
        { roomId, messageId, emoji }
      );

      const payload = { ...result };
      this.server.to(`chat_room_${roomId}`).emit('reaction:updated', payload);
      return { ok: true, data: payload };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: { code: 'REACTION_FAILED', message } };
    }
  }

  @SubscribeMessage('reaction:remove')
  async handleReactionRemove(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { roomId?: string; messageId?: string }
  ) {
    try {
      this.requireSocketUser(client);
      const roomId = String(body?.roomId ?? '').trim();
      const messageId = String(body?.messageId ?? '').trim();
      if (!roomId || !messageId) {
        return {
          ok: false,
          error: { code: 'BAD_REQUEST', message: 'roomId and messageId are required' },
        };
      }

      const result = await this.chatService.removeReaction(
        { sub: client.userId, tenantId: client.tenantId, roles: client.roles ?? [] },
        { roomId, messageId }
      );

      const payload = { ...result };
      this.server.to(`chat_room_${roomId}`).emit('reaction:removed', payload);
      return { ok: true, data: payload };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: { code: 'REACTION_FAILED', message } };
    }
  }

  @SubscribeMessage('pin:add')
  async handlePinAdd(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { roomId?: string; messageId?: string }
  ) {
    try {
      this.requireSocketUser(client);
      const roomId = String(body?.roomId ?? '').trim();
      const messageId = String(body?.messageId ?? '').trim();
      if (!roomId || !messageId) {
        return {
          ok: false,
          error: { code: 'BAD_REQUEST', message: 'roomId and messageId are required' },
        };
      }

      const result = await this.chatService.addPin(
        { sub: client.userId, tenantId: client.tenantId, roles: client.roles ?? [] },
        { roomId, messageId }
      );

      const payload = { ...result };
      this.server.to(`chat_room_${roomId}`).emit('pin:added', payload);
      return { ok: true, data: payload };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: { code: 'PIN_FAILED', message } };
    }
  }

  @SubscribeMessage('pin:remove')
  async handlePinRemove(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { roomId?: string; messageId?: string }
  ) {
    try {
      this.requireSocketUser(client);
      const roomId = String(body?.roomId ?? '').trim();
      const messageId = String(body?.messageId ?? '').trim();
      if (!roomId || !messageId) {
        return {
          ok: false,
          error: { code: 'BAD_REQUEST', message: 'roomId and messageId are required' },
        };
      }

      const result = await this.chatService.removePin(
        { sub: client.userId, tenantId: client.tenantId, roles: client.roles ?? [] },
        { roomId, messageId }
      );

      const payload = { ...result };
      this.server.to(`chat_room_${roomId}`).emit('pin:removed', payload);
      return { ok: true, data: payload };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: { code: 'PIN_FAILED', message } };
    }
  }

  @SubscribeMessage('message:markReadUpTo')
  async handleMarkReadUpTo(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() body: { roomId?: string; messageId?: string }
  ) {
    try {
      this.requireSocketUser(client);
      const roomId = String(body?.roomId ?? '').trim();
      const messageId = String(body?.messageId ?? '').trim();
      if (!roomId || !messageId) {
        return {
          ok: false,
          error: { code: 'BAD_REQUEST', message: 'roomId and messageId are required' },
        };
      }

      const result = await this.chatService.markReadUpTo(
        {
          sub: client.userId,
          tenantId: client.tenantId,
          roles: client.roles ?? [],
        },
        { roomId, messageId }
      );

      const eventPayload = {
        roomId,
        userId: client.userId,
        readUpToMessageId: result.readUpToMessageId,
        readAt: result.readAt,
      };

      this.server.to(`chat_room_${roomId}`).emit('message:readUpTo', eventPayload);
      return { ok: true, data: eventPayload };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: { code: 'READ_FAILED', message } };
    }
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: AuthenticatedSocket) {
    return { event: 'pong', userId: client.userId };
  }
}
