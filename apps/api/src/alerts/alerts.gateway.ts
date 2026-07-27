import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import { createDb, schema, type Database } from '@caregiver/db';
import type { UserProfile } from '@caregiver/contracts';
import type { AlertDispatchedPayload } from '@caregiver/contracts';

@WebSocketGateway({
  namespace: '/',
  cors: {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:4200',
    credentials: true,
  },
})
export class AlertsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger('AlertsGateway');
  private readonly db: Database;

  @WebSocketServer()
  server!: Server;

  constructor(private readonly jwtService: JwtService) {
    this.db = createDb();
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) {
        this.logger.warn(`Client ${client.id} rejected: no token provided`);
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      const role = payload.role as string;
      const userId = payload.sub as string;

      await client.join(`role:${role}`);
      await client.join(`user:${userId}`);

      (client.data as { user: UserProfile }).user = {
        id: userId,
        email: payload.email,
        fullName: '',
        role,
        isActive: true,
      };

      this.logger.log(`Client ${client.id} connected (user: ${userId}, role: ${role})`);
    } catch {
      this.logger.warn(`Client ${client.id} rejected: invalid token`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    const user = (client.data as { user?: UserProfile }).user;
    if (user) {
      this.logger.log(`Client ${client.id} disconnected (user: ${user.id})`);
    }
  }

  @SubscribeMessage('alert:acknowledge')
  async handleAcknowledge(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { alertId: string },
  ): Promise<{ success: boolean }> {
    const user = (client.data as { user?: UserProfile }).user;
    if (!user) {
      return { success: false };
    }

    try {
      await this.db
        .update(schema.alerts)
        .set({
          acknowledged: true,
          acknowledgedBy: user.id,
          acknowledgedAt: new Date(),
        })
        .where(eq(schema.alerts.id, data.alertId));

      this.logger.log(`Alert ${data.alertId} acknowledged by ${user.id}`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to acknowledge alert ${data.alertId}: ${error}`);
      return { success: false };
    }
  }

  broadcastAlert(alert: AlertDispatchedPayload): void {
    for (const role of alert.targetRoles) {
      this.server.to(`role:${role}`).emit('alert', alert);
    }

    this.server.to(`user:${alert.patientId}`).emit('alert', alert);

    this.logger.log(`Alert ${alert.alertId} broadcast to roles: ${alert.targetRoles.join(', ')}`);
  }
}
