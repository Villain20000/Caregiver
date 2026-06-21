/**
 * apps/api/src/auth/jwt.strategy.ts
 *
 * JWT Passport strategy — extracts and validates the JWT from the
 * Authorization header, then loads the user profile from the database.
 *
 * The validated user is attached to `req.user` for downstream guards
 * and controllers.
 */
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from './auth.service.js';
import type { UserProfile } from '@caregiver/contracts';

/**
 * JWT payload structure (encoded in the token).
 * `sub` is the user ID, `email` and `role` are for quick access.
 */
interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  type?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(private readonly authService: AuthService) {
    super({
      // Extract JWT from the Authorization: Bearer <token> header.
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // Don't ignore expiry — expired tokens are rejected.
      ignoreExpiration: false,
      // Secret key from environment.
      secretOrKey: process.env.JWT_SECRET ?? 'caregiver-dev-secret-change-in-production',
    });
  }

  /**
   * Validate the JWT payload and return the user profile.
   * Called automatically by Passport after token verification.
   *
   * @param payload - The decoded JWT payload.
   * @returns The user profile (attached to req.user).
   * @throws UnauthorizedException if the user no longer exists.
   */
  async validate(payload: JwtPayload): Promise<UserProfile> {
    // Load the user from the database (ensures they're still active).
    const user = await this.authService.validateUser(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found or deactivated');
    }
    return user;
  }
}
