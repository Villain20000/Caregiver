/**
 * apps/api/src/alerts/alerts.gateway.ts
 *
 * Socket.io gateway — real-time alert delivery to the Angular frontend.
 *
 * Architecture:
 *   1. The notifications microservice consumes `alert.dispatched` Kafka events
 *   2. It calls the API gateway's internal HTTP endpoint (or uses a Redis pub/sub)
 *      to forward the alert to the Socket.io gateway
 *   3. The gateway emits the alert to the appropriate role-based rooms
 *
 * Room strategy:
 *   - Each role has a room: 'role:doctor', 'role:nurse', etc.
 *   - Each user has a room: 'user:<userId>'
 *   - Alerts are emitted to the target role rooms + the patient's user room
 *
 * Authentication:
 *   - The JWT is passed in the connection handshake (auth.token)
 *   - The gateway verifies the JWT and extracts the user's role + ID
 *   - The user is joined to their role room and personal room
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
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import type { UserProfile } from '@caregiver/contracts';
import type { AlertDispatchedPayload } from '@caregiver/contracts';

// WebSocket gateway on the /socket.io namespace, port from env.
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

  constructor(private readonly jwtService: JwtService) {}

  /**
   * Handle a new client connection.
   * Verifies the JWT from the handshake and joins the client to rooms.
   */
  async handleConnection(client: Socket): Promise<void> {
    try {
      // Extract the JWT from the handshake auth object.
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) {
        this.logger.warn(`Client ${client.id} rejected: no token provided`);
        client.disconnect();
        return;
      }

      // Verify the JWT and extract the user.
      const payload = this.jwtService.verify(token);
      const role = payload.role as string;
      const userId = payload.sub as string;

      // Join the client to their role room and personal room.
      await client.join(`role:${role}`);
      await client.join(`user:${userId}`);

      // Store the user info on the socket for later use.
      (client.data as { user: UserProfile }).user = {
        id: userId,
        email: payload.email,
        fullName: '', // Not in JWT; could be fetched from DB if needed.
        role,
        isActive: true,
      };

      this.logger.log(`Client ${client.id} connected (user: ${userId}, role: ${role})`);
    } catch {
      this.logger.warn(`Client ${client.id} rejected: invalid token`);
      client.disconnect();
    }
  }

  /**
   * Handle client disconnection.
   */
  handleDisconnect(client: Socket): void {
    const user = (client.data as { user?: UserProfile }).user;
    if (user) {
      this.logger.log(`Client ${client.id} disconnected (user: ${user.id})`);
    }
  }

  /**
   * Handle 'alert:acknowledge' message from the client.
   * Called when a user acknowledges an alert in the frontend.
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

    this.logger.log(`Alert ${data.alertId} acknowledged by ${user.id}`);
    // In a full implementation, this would update the DB and emit a Kafka event.
    return { success: true };
  }

  /**
   * Broadcast an alert to the appropriate rooms.
   * Called by the notifications service (via internal HTTP or Redis pub/sub).
   *
   * @param alert - The alert payload (from the alert.dispatched Kafka event).
   */
  broadcastAlert(alert: AlertDispatchedPayload): void {
    // Emit to each target role room.
    for (const role of alert.targetRoles) {
      this.server.to(`role:${role}`).emit('alert', alert);
    }

    // Also emit to the patient's personal room (if they're connected).
    this.server.to(`user:${alert.patientId}`).emit('alert', alert);

    this.logger.log(`Alert ${alert.alertId} broadcast to roles: ${alert.targetRoles.join(', ')}`);
  }
}
