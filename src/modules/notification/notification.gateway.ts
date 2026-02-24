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
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
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

  // Emit to all connected platform admins (for system-wide notifications)
  emitNotificationToAdmins(notification: any) {
    this.server.emit('notification', notification);
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() client: AuthenticatedSocket) {
    return { event: 'pong', userId: client.userId };
  }
}
