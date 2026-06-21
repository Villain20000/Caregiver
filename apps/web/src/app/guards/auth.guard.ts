/**
 * apps/web/src/app/guards/auth.guard.ts
 *
 * Auth guard — protects routes that require authentication.
 *
 * If the user is authenticated (signal is truthy), allow navigation.
 * If not, redirect to /login with a return URL query param.
 *
 * Uses the functional guard style (Angular 17+).
 */
import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service.js';

/**
 * Functional auth guard — checks if the user is authenticated.
 * Redirects to /login if not, preserving the attempted URL.
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  // Redirect to login with the return URL so we can navigate back after login.
  void router.navigate(['/login'], {
    queryParams: { returnUrl: state.url },
  });

  return false;
};
