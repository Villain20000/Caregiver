/**
 * apps/api/src/auth/auth.controller.ts
 *
 * Auth controller — REST endpoints for authentication.
 *
 * Endpoints:
 *   POST /api/auth/login    → authenticate and receive JWT tokens
 *   POST /api/auth/refresh  → exchange refresh token for new access token
 *   GET  /api/auth/me       → get the current user's profile (requires auth)
 */
import { Body, Controller, Get, Post, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import type { LoginRequest, LoginResponse, RefreshTokenResponse, UserProfile } from '@caregiver/contracts';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /api/auth/login — authenticate with email + password.
   * Returns access token, refresh token, and user profile.
   */
  @Post('login')
  async login(@Body() body: LoginRequest): Promise<LoginResponse> {
    return this.authService.login(body);
  }

  /**
   * POST /api/auth/refresh — exchange a refresh token for new tokens.
   * Body: { refreshToken: string }
   */
  @Post('refresh')
  async refresh(@Body('refreshToken') refreshToken: string): Promise<RefreshTokenResponse> {
    return this.authService.refresh(refreshToken);
  }

  /**
   * GET /api/auth/me — get the current user's profile.
   * Requires a valid JWT in the Authorization header.
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Request() req: { user: UserProfile }): Promise<UserProfile> {
    return req.user;
  }
}
