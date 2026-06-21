/**
 * packages/contracts/src/dto/auth.dto.ts
 *
 * REST DTOs for authentication endpoints.
 * Used by the NestJS API gateway for request validation (class-validator).
 */

/** Login request body — POST /api/auth/login. */
export interface LoginRequest {
  /** User's email address. */
  email: string;
  /** User's password (plaintext, sent over HTTPS). */
  password: string;
}

/** Login response body — returned after successful authentication. */
export interface LoginResponse {
  /** JWT access token (short-lived, 15min). */
  accessToken: string;
  /** JWT refresh token (long-lived, 7d). */
  refreshToken: string;
  /** Token type (always 'Bearer'). */
  tokenType: 'Bearer';
  /** Access token expiry in seconds. */
  expiresIn: number;
  /** The authenticated user's profile. */
  user: UserProfile;
}

/** User profile — embedded in login response and JWT payload. */
export interface UserProfile {
  /** User's UUID. */
  id: string;
  /** User's email. */
  email: string;
  /** User's full name. */
  fullName: string;
  /** User's role (one of the 10 healthcare roles). */
  role: string;
  /** Whether the account is active. */
  isActive: boolean;
}

/** Refresh token request body — POST /api/auth/refresh. */
export interface RefreshTokenRequest {
  /** The refresh token to exchange for a new access token. */
  refreshToken: string;
}

/** Refresh token response body. */
export interface RefreshTokenResponse {
  /** New JWT access token. */
  accessToken: string;
  /** New JWT refresh token (rotated). */
  refreshToken: string;
  /** Token type. */
  tokenType: 'Bearer';
  /** Access token expiry in seconds. */
  expiresIn: number;
}
