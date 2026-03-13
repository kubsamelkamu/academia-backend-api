import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  tenantId?: string;
}

@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void
    ) => {
      // Keep Socket.IO CORS aligned with the HTTP API allowlist in `src/main.ts`.
      // NOTE: WebSockets may not send an Origin in some environments; allow such connections.
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
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationGateway.name);

  constructor(private readonly jwtService: JwtService) {}

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

      // Join user-specific room for targeted notifications
      client.join(`user_${client.userId}`);

      this.logger.log(`Client connected: ${client.id} (User: ${client.userId})`);
    } catch (error) {
      this.logger.error(`Connection failed: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // Emit notification to specific user
  emitNotificationToUser(userId: string, notification: any) {
    this.server.to(`user_${userId}`).emit('notification', notification);
  }

  emitEventToUser(userId: string, event: string, payload: any) {
    this.server.to(`user_${userId}`).emit(event, payload);
  }

  emitEventToUsers(userIds: string[], event: string, payload: any) {
    const uniqueUserIds = Array.from(new Set((userIds ?? []).filter(Boolean)));
    for (const userId of uniqueUserIds) {
      this.emitEventToUser(userId, event, payload);
    }
  }

  // Emit to all connected platform admins (for system-wide notifications)
  emitNotificationToAdmins(notification: any) {
    this.server.emit('notification', notification);
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: AuthenticatedSocket) {
    return { event: 'pong', userId: client.userId };
  }
}
