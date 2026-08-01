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
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
  Request,
  Logger,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import type {
  LoginRequest,
  LoginResponse,
  RefreshTokenResponse,
  UserProfile,
} from '@caregiver/contracts';

interface SessionResponse {
  id: string;
  createdAt: string;
  expiresAt: string;
  current: boolean;
}

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger('AuthController');

  constructor(private readonly authService: AuthService) {}

  /**
   * POST /api/auth/login — authenticate with email + password.
   */
  @Post('login')
  async login(@Body() body: LoginRequest): Promise<LoginResponse> {
    return this.authService.login(body);
  }

  /**
   * POST /api/auth/refresh — exchange a refresh token for new tokens.
   */
  @Post('refresh')
  async refresh(@Body('refreshToken') refreshToken: string): Promise<RefreshTokenResponse> {
    return this.authService.refresh(refreshToken);
  }

  /**
   * GET /api/auth/me — get the current user's profile.
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Request() req: { user: UserProfile }): Promise<UserProfile> {
    return req.user;
  }

  /**
   * POST /api/auth/change-password — change the current user's password.
   */
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  async changePassword(
    @Body() body: { currentPassword: string; newPassword: string },
    @Request() req: { user: UserProfile },
  ): Promise<{ success: boolean }> {
    await this.authService.changePassword(req.user.id, body.currentPassword, body.newPassword);
    return { success: true };
  }

  /**
   * POST /api/auth/forgot-password — request a password reset email.
   */
  @Post('forgot-password')
  async forgotPassword(@Body('email') email: string): Promise<{ success: boolean }> {
    await this.authService.forgotPassword(email);
    // Always return success to prevent email enumeration
    return { success: true };
  }

  /**
   * POST /api/auth/reset-password — reset password with a reset token.
   */
  @Post('reset-password')
  async resetPassword(
    @Body() body: { token: string; newPassword: string },
  ): Promise<{ success: boolean }> {
    await this.authService.resetPassword(body.token, body.newPassword);
    return { success: true };
  }

  /**
   * GET /api/auth/sessions — list active sessions for the current user.
   */
  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  async listSessions(
    @Request() req: { user: UserProfile; headers: Record<string, string> },
  ): Promise<SessionResponse[]> {
    // Extract the current token ID from the authorization header
    const authHeader = req.headers?.authorization ?? '';
    const token = authHeader.replace('Bearer ', '');
    let currentTokenId: string | undefined;
    try {
      const payload = this.authService['jwtService'].verify(token);
      currentTokenId = payload.jti;
    } catch {
      // If we can't verify, just don't highlight any session
    }
    return this.authService.listSessions(req.user.id, currentTokenId);
  }

  /**
   * DELETE /api/auth/sessions/:id — revoke a specific session.
   */
  @UseGuards(JwtAuthGuard)
  @Delete('sessions/:id')
  async revokeSession(
    @Param('id') id: string,
    @Request() req: { user: UserProfile },
  ): Promise<{ success: boolean }> {
    await this.authService.revokeSession(id, req.user.id);
    return { success: true };
  }

  /**
   * DELETE /api/auth/sessions — revoke all sessions except current.
   */
  @UseGuards(JwtAuthGuard)
  @Delete('sessions')
  async revokeAllSessions(@Request() req: { user: UserProfile }): Promise<{ success: boolean }> {
    await this.authService.revokeAllSessions(req.user.id);
    return { success: true };
  }
}
