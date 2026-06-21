/**
 * apps/api/src/auth/auth.module.ts
 *
 * Auth module — handles JWT authentication.
 *
 * Provides:
 *   - AuthController (POST /api/auth/login, POST /api/auth/refresh)
 *   - AuthService (password verification, JWT issuance)
 *   - JwtStrategy (extracts user from JWT on protected routes)
 *   - JwtAuthGuard (protects routes requiring authentication)
 */
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtStrategy } from './jwt.strategy.js';

@Module({
  // JWT module with secret + expiry from environment.
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'caregiver-dev-secret-change-in-production',
      signOptions: { expiresIn: '15m' }, // Access token: 15 minutes.
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  // AuthService is exported so other modules can access the current user.
  exports: [AuthService],
})
export class AuthModule {}
