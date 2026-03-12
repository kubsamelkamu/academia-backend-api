import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { AdvisorService } from './advisor.service';
import { WsJwtGuard } from '../../common/guards/ws-jwt.guard';

@WebSocketGateway({
  namespace: 'advisors',
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
})
@UseGuards(WsJwtGuard)
export class AdvisorGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private advisorSockets: Map<string, Set<string>> = new Map(); // advisorId -> Set<socketId>
  private socketAdvisors: Map<string, string> = new Map(); // socketId -> advisorId

  constructor(private readonly advisorService: AdvisorService) {}

  async handleConnection(client: Socket) {
    try {
      const userId = client.data.user?.id;
      if (!userId) {
        client.disconnect();
        return;
      }

      // Check if user is an advisor
      const advisor = await this.advisorService.findByUserId(userId);
      if (!advisor) {
        client.disconnect();
        return;
      }

      // Store connection
      const advisorId = advisor.id;
      if (!this.advisorSockets.has(advisorId)) {
        this.advisorSockets.set(advisorId, new Set());
      }
      this.advisorSockets.get(advisorId).add(client.id);
      this.socketAdvisors.set(client.id, advisorId);

      // Join advisor-specific room
      client.join(`advisor:${advisorId}`);
      
      // Send initial data
      await this.sendInitialData(client, advisorId);
      
      // Notify about advisor online status
      this.server.emit('advisor:status', {
        advisorId,
        status: 'online',
        timestamp: new Date(),
      });
    } catch (error) {
      client.emit('error', { message: 'Connection failed' });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const advisorId = this.socketAdvisors.get(client.id);
    if (advisorId) {
      const sockets = this.advisorSockets.get(advisorId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.advisorSockets.delete(advisorId);
          // Notify about advisor offline status
          this.server.emit('advisor:status', {
            advisorId,
            status: 'offline',
            timestamp: new Date(),
          });
        }
      }
      this.socketAdvisors.delete(client.id);
    }
  }

  @SubscribeMessage('advisor:subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { advisorId: string },
  ) {
    const userAdvisorId = this.socketAdvisors.get(client.id);
    
    if (userAdvisorId !== data.advisorId) {
      const hasPermission = await this.hasPermission(client.data.user, data.advisorId);
      if (!hasPermission) {
        throw new WsException('Unauthorized');
      }
    }

    client.join(`advisor-updates:${data.advisorId}`);
    return { event: 'advisor:subscribed', data: { advisorId: data.advisorId } };
  }

  @SubscribeMessage('advisor:unsubscribe')
  async handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { advisorId: string },
  ) {
    client.leave(`advisor-updates:${data.advisorId}`);
    return { event: 'advisor:unsubscribed', data: { advisorId: data.advisorId } };
  }

  @SubscribeMessage('advisor:get-availability')
  async handleGetAvailability(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { advisorId?: string },
  ) {
    try {
      let advisorId = data.advisorId;
      
      if (!advisorId) {
        advisorId = this.socketAdvisors.get(client.id);
        if (!advisorId) {
          throw new WsException('Advisor not found');
        }
      }

      const availability = await this.advisorService.checkAvailability(advisorId);
      client.emit('advisor:availability', availability);
    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('advisor:get-dashboard')
  async handleGetDashboard(@ConnectedSocket() client: Socket) {
    try {
      const advisorId = this.socketAdvisors.get(client.id);
      if (!advisorId) {
        throw new WsException('Advisor not found');
      }

      const dashboardData = await this.advisorService.getDashboardData(advisorId);
      client.emit('advisor:dashboard', dashboardData);
    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('advisor:get-projects')
  async handleGetProjects(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { status?: string },
  ) {
    try {
      const advisorId = this.socketAdvisors.get(client.id);
      if (!advisorId) {
        throw new WsException('Advisor not found');
      }

      const projects = await this.advisorService.getAdvisorProjects(advisorId, data.status);
      client.emit('advisor:projects', projects);
    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('advisor:mark-notification-read')
  async handleMarkNotificationRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { notificationId: string },
  ) {
    try {
      const advisorId = this.socketAdvisors.get(client.id);
      if (!advisorId) {
        throw new WsException('Advisor not found');
      }

      await this.advisorService.markNotificationRead(advisorId, data.notificationId);
      client.emit('advisor:notification-marked-read', { notificationId: data.notificationId });
    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }

  @SubscribeMessage('advisor:ping')
  handlePing(@ConnectedSocket() client: Socket) {
    client.emit('advisor:pong', { timestamp: new Date() });
  }

  // Public methods for emitting events
  async notifyProjectAssigned(advisorId: string, projectData: any) {
    this.server.to(`advisor:${advisorId}`).emit('advisor:project-assigned', projectData);
    this.server.to(`advisor-updates:${advisorId}`).emit('advisor:project-assigned', projectData);
  }

  async notifyMilestoneSubmitted(advisorId: string, milestoneData: any) {
    this.server.to(`advisor:${advisorId}`).emit('advisor:milestone-submitted', milestoneData);
    this.server.to(`advisor-updates:${advisorId}`).emit('advisor:milestone-submitted', milestoneData);
  }

  async notifyEvaluationReminder(advisorId: string, evaluationData: any) {
    this.server.to(`advisor:${advisorId}`).emit('advisor:evaluation-reminder', evaluationData);
  }

  async notifyReviewRequested(advisorId: string, reviewData: any) {
    this.server.to(`advisor:${advisorId}`).emit('advisor:review-requested', reviewData);
  }

  async updateAdvisorLoad(advisorId: string, loadUpdate: any) {
    this.server.to(`advisor-updates:${advisorId}`).emit('advisor:load-updated', loadUpdate);
    this.server.emit('admin:advisor-load-updated', loadUpdate);
  }

  private async sendInitialData(client: Socket, advisorId: string) {
    try {
      const [dashboard, availability] = await Promise.all([
        this.advisorService.getDashboardData(advisorId),
        this.advisorService.checkAvailability(advisorId),
      ]);

      client.emit('advisor:initial-data', {
        dashboard,
        availability,
      });
    } catch (error) {
      console.error('Error sending initial data:', error);
    }
  }

  private async hasPermission(user: any, targetAdvisorId: string): Promise<boolean> {
    if (user.roles?.includes('PLATFORM_ADMIN') || user.roles?.includes('TENANT_ADMIN')) {
      return true;
    }

    if (user.roles?.includes('DEPARTMENT_HEAD')) {
      const advisor = await this.advisorService.findOne(targetAdvisorId);
      return advisor.departmentId === user.departmentId;
    }

    return false;
  }
}