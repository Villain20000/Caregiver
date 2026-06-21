/**
 * apps/web/src/app/interceptors/auth.interceptor.ts
 *
 * HTTP interceptor — attaches the JWT access token to all API requests.
 *
 * Reads the token from the AuthService signal. If no token is present
 * (user not logged in), the request proceeds without the Authorization
 * header (the login endpoint doesn't require auth).
 *
 * On 401 responses, the interceptor could trigger a token refresh.
 * For Phase 2, we simply redirect to login on 401.
 */
import { type HttpInterceptorFn, type HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service.js';
import { Router } from '@angular/router';

/**
 * Auth interceptor function (Angular 17+ functional interceptor style).
 * Attaches `Authorization: Bearer <token>` to all outgoing requests.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Get the current token from the signal.
  const token = authService.token();

  // Clone the request and add the Authorization header if we have a token.
  const authReq = token
    ? req.clone({
        setHeaders: { Authorization: `Bearer ${token}` },
      })
    : req;

  // Pass the (possibly modified) request to the next handler.
  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // On 401 Unauthorized, logout and redirect to login.
      if (error.status === 401) {
        authService.logout();
        void router.navigate(['/login']);
      }
      return throwError(() => error);
    }),
  );
};
