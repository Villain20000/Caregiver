/**
 * apps/api/src/auth/jwt-auth.guard.ts
 *
 * JWT auth guard — protects routes that require authentication.
 *
 * Uses Passport's jwt strategy to verify the JWT in the Authorization header.
 * If valid, the user profile is available on `req.user`.
 *
 * Usage:
 *   @UseGuards(JwtAuthGuard)
 *   @Get('profile')
 *   getProfile(@Request() req) { return req.user; }
 */
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
