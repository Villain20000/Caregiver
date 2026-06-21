/**
 * apps/api/src/main.ts
 *
 * NestJS API Gateway — application entry point.
 *
 * This is the BFF (Backend For Frontend) — the only service that holds
 * synchronous REST/Socket.io connections to the Angular frontend.
 * All cross-service communication flows through Apache Kafka.
 *
 * Responsibilities:
 *   1. Authentication (JWT issuance + verification)
 *   2. RBAC enforcement (using @caregiver/rbac guards)
 *   3. REST endpoints (appointments, vitals, AI diagnosis, FHIR)
 *   4. Socket.io gateway (real-time alerts to the frontend)
 *   5. Kafka producer (emits events to backend microservices)
 *
 * The gateway does NOT contain business logic — it delegates to
 * microservices via Kafka events and aggregates their responses.
 */
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  // Create the NestJS application instance.
  const app = await NestFactory.create(AppModule, {
    // Enable CORS for the Angular dev server (localhost:4200).
    cors: {
      origin: process.env.CORS_ORIGIN ?? 'http://localhost:4200',
      credentials: true,
    },
    // Buffer logs until the logger is ready (avoids losing early logs).
    bufferLogs: true,
  });

  // Use Socket.io adapter for WebSocket support.
  app.useWebSocketAdapter(new IoAdapter(app));

  // Global validation pipe — validates all incoming DTOs.
  app.useGlobalPipes(
    new ValidationPipe({
      // Strip unknown properties (prevents mass assignment).
      whitelist: true,
      // Reject requests with unknown properties (strict).
      forbidNonWhitelisted: true,
      // Auto-transform payloads to DTO instances.
      transform: true,
    }),
  );

  // Global API prefix — all endpoints are under /api.
  app.setGlobalPrefix('api');

  // Start listening on the configured port (default 3000).
  const port = parseInt(process.env.API_PORT ?? '3000', 10);
  await app.listen(port);

  logger.log(`Caregiver API Gateway listening on http://localhost:${port}`);
  logger.log(`CORS origin: ${process.env.CORS_ORIGIN ?? 'http://localhost:4200'}`);
}

// Start the application.
void bootstrap();
