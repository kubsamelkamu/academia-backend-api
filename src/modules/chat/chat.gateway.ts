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
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  private readonly roomUserSocketCounts = new Map<string, Map<string, number>>();
  private readonly socketRooms = new Map<string, Set<string>>();

  private readonly roomUserTypingCounts = new Map<string, Map<string, number>>();
  private readonly socketTypingRooms = new Map<string, Set<string>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly chatService: ChatService
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

  handleDisconnect(client: AuthenticatedSocket) {
    this.handleTypingDisconnect(client);
    this.handlePresenceDisconnect(client);
    this.logger.log(`Client disconnected: ${client.id}`);
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

  private emitTypingUpdate(roomId: string, payload: { roomId: string; userId: string; isTyping: boolean; at: Date }) {
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
