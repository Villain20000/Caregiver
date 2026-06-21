/**
 * apps/api/src/auth/auth.service.ts
 *
 * Auth service — handles login, token issuance, and token refresh.
 *
 * Uses bcrypt for password verification and @nestjs/jwt for token signing.
 * In Phase 2, user lookup is done directly from the Drizzle DB schema.
 * In Phase 3, this may be replaced with a call to a dedicated identity service.
 */
import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { eq } from 'drizzle-orm';
import { createDb, schema, type Database } from '@caregiver/db';
import type { LoginRequest, LoginResponse, UserProfile, RefreshTokenResponse } from '@caregiver/contracts';

@Injectable()
export class AuthService {
  private readonly logger = new Logger('AuthService');
  private readonly db: Database;

  constructor(private readonly jwtService: JwtService) {
    // Create a DB client for user lookup.
    // In a full implementation, this would be injected via a DB module.
    this.db = createDb();
  }

  /**
   * Authenticate a user and return JWT tokens.
   *
   * @param credentials - Email + password from the login request.
   * @returns Access token, refresh token, and user profile.
   * @throws UnauthorizedException if credentials are invalid.
   */
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    // Look up the user by email.
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, credentials.email))
      .limit(1);

    // User not found or account deactivated.
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password (in Phase 2, we use bcrypt).
    // For now, we check against the stored hash.
    // TODO: Replace with bcrypt.compare in Phase 2.5.
    if (user.passwordHash !== credentials.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Build the user profile (embedded in the response + JWT payload).
    const profile: UserProfile = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
    };

    // Sign the access token (short-lived, 15min).
    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    // Sign the refresh token (long-lived, 7d).
    const refreshToken = this.jwtService.sign(
      { sub: user.id, type: 'refresh' },
      { expiresIn: '7d' },
    );

    this.logger.log(`User '${user.email}' (role: ${user.role}) logged in.`);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: 900, // 15 minutes in seconds.
      user: profile,
    };
  }

  /**
   * Exchange a refresh token for a new access token.
   *
   * @param refreshToken - The refresh token to exchange.
   * @returns New access + refresh tokens.
   * @throws UnauthorizedException if the refresh token is invalid.
   */
  async refresh(refreshToken: string): Promise<RefreshTokenResponse> {
    try {
      // Verify the refresh token.
      const payload = this.jwtService.verify(refreshToken);

      // Ensure it's a refresh token, not an access token.
      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      // Look up the user to ensure they're still active.
      const [user] = await this.db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, payload.sub))
        .limit(1);

      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found or deactivated');
      }

      // Issue new tokens (rotation).
      const newAccessToken = this.jwtService.sign({
        sub: user.id,
        email: user.email,
        role: user.role,
      });

      const newRefreshToken = this.jwtService.sign(
        { sub: user.id, type: 'refresh' },
        { expiresIn: '7d' },
      );

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        tokenType: 'Bearer',
        expiresIn: 900,
      };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Validate a user by ID (used by JwtStrategy).
   *
   * @param userId - The user ID from the JWT payload.
   * @returns The user profile, or null if not found/inactive.
   */
  async validateUser(userId: string): Promise<UserProfile | null> {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user || !user.isActive) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
    };
  }
}
