/**
 * apps/api/src/alerts/alerts.gateway.ts
 *
 * Socket.io WebSocket gateway — real-time alert delivery to Angular clients.
 *
 * 📝 NestJS Concepts Demonstrated:
 *   - **@WebSocketGateway()** — decorator to create a Socket.io server
 *   - **@WebSocketServer()** — decorator to get the Socket.io Server instance
 *   - **OnGatewayConnection/Disconnect** — lifecycle hooks for client events
 *   - **@SubscribeMessage()** — listen for client-emitted events
 *   - **JWT authentication** via handshake.auth.token on connection
 *   - **Socket rooms** for role-based fan-out (`role:doctor`, `user:123`)
 *
 * Flow:
 *   1. Client connects with JWT in handshake.auth
 *   2. Server verifies JWT → client joins `role:<role>` + `user:<userId>` rooms
 *   3. `broadcastAlert()` is called by the Kafka consumer (alert.dispatched)
 *   4. Server emits 'alert' event to the appropriate rooms
 *   5. Client acknowledges → server emits `alert.acknowledged` on Kafka;
 *      the notifications service persists the ack (this gateway performs
 *      NO direct DB writes — BFF pattern).
 */
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, Inject } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import type { TypedProducer } from '@caregiver/kafka';
import type {
  UserProfile,
  AlertDispatchedPayload,
  AlertAcknowledgedPayload,
} from '@caregiver/contracts';
import { KAFKA_PRODUCER } from '../kafka/kafka.module.js';

@WebSocketGateway({
  namespace: '/',
  cors: {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:4200',
    credentials: true,
  },
})
export class AlertsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger('AlertsGateway');

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    @Inject(KAFKA_PRODUCER) private readonly producer: TypedProducer,
  ) {}

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

  /**
   * Client acknowledges an alert (dismiss button).
   *
   * The gateway does NOT write to the database — it emits an
   * `alert.acknowledged` Kafka event that the notifications service
   * consumes to persist acknowledged/acknowledgedBy/acknowledgedAt.
   * This keeps ALL alert persistence in the notifications service
   * (consistent with creation + escalation).
   */
  @SubscribeMessage('alert:acknowledge')
  async handleAcknowledge(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { alertId: string },
  ): Promise<{ success: boolean }> {
    const user = (client.data as { user?: UserProfile }).user;
    if (!user) {
      return { success: false };
    }
    // Defensive: never dispatch a Kafka event without a usable alert id.
    // The socket body is untrusted runtime input (no class-validator on
    // gateways), so guard against a missing body, missing/null id,
    // non-string ids, and whitespace-only ids alike.
    if (typeof data?.alertId !== 'string' || !data.alertId.trim()) {
      return { success: false };
    }

    const payload: AlertAcknowledgedPayload = {
      alertId: data.alertId,
      acknowledgedBy: user.id,
      acknowledgedAt: new Date().toISOString(),
    };

    try {
      await this.producer.send('alert.acknowledged', payload, {
        correlationId: data.alertId,
        userId: user.id,
        userRole: user.role,
      });

      this.logger.log(`Alert ${data.alertId} acknowledgment dispatched for ${user.id}`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to dispatch acknowledgment for alert ${data.alertId}: ${error}`);
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
