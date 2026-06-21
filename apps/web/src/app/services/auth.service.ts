/**
 * apps/web/src/app/services/auth.service.ts
 *
 * Auth service — manages authentication state using Angular 17+ signals.
 *
 * Uses the new signal API for reactive state management:
 *   - currentUser() → signal holding the logged-in user (or null)
 *   - isAuthenticated() → computed signal (true if user is present)
 *   - token() → signal holding the JWT access token
 *
 * On login, stores tokens in localStorage and populates signals.
 * On logout, clears localStorage and resets signals.
 *
 * The auth interceptor reads the token signal to attach it to HTTP requests.
 */
import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import type { LoginRequest, LoginResponse, UserProfile } from '@caregiver/contracts';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  // API base URL — proxied to the NestJS gateway in dev (Angular CLI proxy).
  private readonly apiUrl = '/api';

  // ── Reactive state (Angular 17+ signals) ───────────────────

  /** Current user profile signal (null when not logged in). */
  private readonly _currentUser = signal<UserProfile | null>(null);

  /** JWT access token signal (null when not logged in). */
  private readonly _token = signal<string | null>(null);

  /** JWT refresh token (stored in localStorage, not a signal — rarely accessed). */
  private _refreshToken: string | null = null;

  // ── Public readonly signals ────────────────────────────────

  /** Read-only signal for the current user. */
  readonly currentUser = this._currentUser.asReadonly();

  /** Read-only signal for the access token. */
  readonly token = this._token.asReadonly();

  /** Computed: true if the user is authenticated. */
  readonly isAuthenticated = computed(() => this._currentUser() !== null);

  /** Computed: the current user's role (or null). */
  readonly userRole = computed(() => this._currentUser()?.role ?? null);

  // ── Lifecycle ──────────────────────────────────────────────

  constructor() {
    // Restore session from localStorage on app init.
    this.restoreSession();
  }

  /**
   * Restore the session from localStorage (called on construction).
   * If tokens exist, populate the signals so the user stays logged in
   * across page refreshes.
   */
  private restoreSession(): void {
    const token = localStorage.getItem('caregiver_access_token');
    const refreshToken = localStorage.getItem('caregiver_refresh_token');
    const userJson = localStorage.getItem('caregiver_user');

    if (token && refreshToken && userJson) {
      try {
        const user = JSON.parse(userJson) as UserProfile;
        this._token.set(token);
        this._refreshToken = refreshToken;
        this._currentUser.set(user);
      } catch {
        // Corrupted localStorage — clear it.
        this.clearStorage();
      }
    }
  }

  /**
   * Login with email + password.
   * On success, stores tokens and populates signals, then navigates to dashboard.
   *
   * @param credentials - Email + password.
   * @returns Observable of the login response.
   */
  login(credentials: LoginRequest) {
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, credentials);
  }

  /**
   * Handle successful login — store tokens and navigate to dashboard.
   * Called by the login component after a successful API response.
   */
  handleLoginSuccess(response: LoginResponse): void {
    this._token.set(response.accessToken);
    this._refreshToken = response.refreshToken;
    this._currentUser.set(response.user);

    // Persist to localStorage for session restoration across refreshes.
    localStorage.setItem('caregiver_access_token', response.accessToken);
    localStorage.setItem('caregiver_refresh_token', response.refreshToken);
    localStorage.setItem('caregiver_user', JSON.stringify(response.user));

    // Navigate to the dashboard.
    void this.router.navigate(['/dashboard']);
  }

  /**
   * Logout — clear all auth state and redirect to login.
   */
  logout(): void {
    this._token.set(null);
    this._refreshToken = null;
    this._currentUser.set(null);
    this.clearStorage();
    void this.router.navigate(['/login']);
  }

  /** Clear all auth-related localStorage entries. */
  private clearStorage(): void {
    localStorage.removeItem('caregiver_access_token');
    localStorage.removeItem('caregiver_refresh_token');
    localStorage.removeItem('caregiver_user');
  }
}
