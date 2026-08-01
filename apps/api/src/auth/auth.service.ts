/**
 * apps/api/src/auth/auth.service.ts
 *
 * Auth service — handles JWT-based authentication and token refresh.
 *
 * 📝 NestJS Concepts Demonstrated:
 *   - **@Injectable()** — marks this as a DI-able service
 *   - **Drizzle ORM** for database queries (PostgreSQL)
 *   - **bcrypt** for password hashing/verification
 *   - **JwtService** from @nestjs/jwt for token signing/verification
 *   - **Logger** for structured logging
 *
 * Flow:
 *   login():   Find user → verify password → sign tokens → store refresh → return
 *   refresh(): Verify refresh → check validity → rotate tokens → return new
 *   validateUser(): Load user from DB → return profile (for JWT strategy)
 *
 * Password hashing uses bcrypt with a salt round of 10 (default).
 * Access tokens expire in 15 minutes; refresh tokens expire in 7 days.
 */
import { Injectable, UnauthorizedException, NotFoundException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { eq, and, isNull, not, like } from 'drizzle-orm';
import { createDb, schema, type Database } from '@caregiver/db';
import * as bcrypt from 'bcrypt';
import type {
  LoginRequest,
  LoginResponse,
  UserProfile,
  RefreshTokenResponse,
} from '@caregiver/contracts';

@Injectable()
export class AuthService {
  private readonly logger = new Logger('AuthService');
  private readonly db: Database;

  constructor(private readonly jwtService: JwtService) {
    this.db = createDb();
  }

  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, credentials.email))
      .limit(1);

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(credentials.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const profile: UserProfile = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
    };

    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshToken = this.jwtService.sign(
      { sub: user.id, type: 'refresh' },
      { expiresIn: '7d' },
    );

    await this.db.insert(schema.refreshTokens).values({
      userId: user.id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    this.logger.log(`User '${user.email}' (role: ${user.role}) logged in.`);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: 900,
      user: profile,
    };
  }

  async refresh(refreshToken: string): Promise<RefreshTokenResponse> {
    try {
      const payload = this.jwtService.verify(refreshToken);

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      const [storedToken] = await this.db
        .select()
        .from(schema.refreshTokens)
        .where(eq(schema.refreshTokens.token, refreshToken))
        .limit(1);

      if (!storedToken || storedToken.revokedAt) {
        throw new UnauthorizedException('Refresh token revoked or not found');
      }

      if (new Date() > storedToken.expiresAt) {
        throw new UnauthorizedException('Refresh token expired');
      }

      const [user] = await this.db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, payload.sub))
        .limit(1);

      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found or deactivated');
      }

      await this.db
        .update(schema.refreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(schema.refreshTokens.token, refreshToken));

      const newAccessToken = this.jwtService.sign({
        sub: user.id,
        email: user.email,
        role: user.role,
      });

      const newRefreshToken = this.jwtService.sign(
        { sub: user.id, type: 'refresh' },
        { expiresIn: '7d' },
      );

      await this.db.insert(schema.refreshTokens).values({
        userId: user.id,
        token: newRefreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        tokenType: 'Bearer',
        expiresIn: 900,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

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

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await this.db
      .update(schema.users)
      .set({ passwordHash: newHash, updatedAt: new Date() })
      .where(eq(schema.users.id, userId));

    // Revoke all sessions except current (force re-login)
    await this.db
      .update(schema.refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(schema.refreshTokens.userId, userId), isNull(schema.refreshTokens.revokedAt)));

    this.logger.log(`Password changed for user ${userId}`);
  }

  async forgotPassword(email: string): Promise<void> {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    if (!user) {
      // Don't reveal whether the email exists (prevents email enumeration)
      return;
    }

    // crypto.randomUUID() is available in Node 20+ — no uuid package needed
    const resetToken = crypto.randomUUID();
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store reset token (using refresh_tokens table as a generic token store)
    await this.db.insert(schema.refreshTokens).values({
      userId: user.id,
      token: `reset_${resetToken}`,
      expiresAt: resetExpires,
    });

    this.logger.warn(
      `Password reset token generated for ${email}: reset_${resetToken}` +
        ' (dev only — in production, send email with reset link. ' +
        'The token endpoints are only accessible in dev mode.)',
    );
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const resetToken = `reset_${token}`;
    const [stored] = await this.db
      .select()
      .from(schema.refreshTokens)
      .where(eq(schema.refreshTokens.token, resetToken))
      .limit(1);

    if (!stored || stored.revokedAt) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    if (new Date() > stored.expiresAt) {
      throw new UnauthorizedException('Reset token has expired');
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await this.db
      .update(schema.users)
      .set({ passwordHash: newHash, updatedAt: new Date() })
      .where(eq(schema.users.id, stored.userId));

    // Revoke the reset token
    await this.db
      .update(schema.refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(schema.refreshTokens.token, resetToken));

    // Revoke all existing sessions (all non-reset refresh tokens for this user)
    await this.db
      .update(schema.refreshTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(schema.refreshTokens.userId, stored.userId),
          isNull(schema.refreshTokens.revokedAt),
          not(like(schema.refreshTokens.token, 'reset_%')),
        ),
      );

    this.logger.log(`Password reset completed for user ${stored.userId}`);
  }

  async listSessions(
    userId: string,
    currentTokenId?: string,
  ): Promise<Array<{ id: string; createdAt: string; expiresAt: string; current: boolean }>> {
    const tokens = await this.db
      .select()
      .from(schema.refreshTokens)
      .where(and(eq(schema.refreshTokens.userId, userId), isNull(schema.refreshTokens.revokedAt)))
      .orderBy(schema.refreshTokens.createdAt);

    return tokens
      .filter((t) => !t.token.startsWith('reset_'))
      .map((t) => ({
        id: t.id,
        createdAt: t.createdAt.toISOString(),
        expiresAt: t.expiresAt.toISOString(),
        current: currentTokenId ? t.id === currentTokenId : false,
      }));
  }

  async revokeSession(sessionId: string, userId: string): Promise<void> {
    const [token] = await this.db
      .select()
      .from(schema.refreshTokens)
      .where(and(eq(schema.refreshTokens.id, sessionId), eq(schema.refreshTokens.userId, userId)))
      .limit(1);

    if (!token) {
      throw new NotFoundException('Session not found');
    }

    await this.db
      .update(schema.refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(schema.refreshTokens.id, sessionId));

    this.logger.log(`Session ${sessionId} revoked for user ${userId}`);
  }

  async revokeAllSessions(userId: string): Promise<void> {
    await this.db
      .update(schema.refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(schema.refreshTokens.userId, userId), isNull(schema.refreshTokens.revokedAt)));

    this.logger.log(`All sessions revoked for user ${userId}`);
  }
}
