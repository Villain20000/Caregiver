/**
 * apps/web/src/app/interceptors/auth.interceptor.ts
 *
 * Angular HTTP interceptor — attaches JWT token to every outgoing request
 * and handles auto-refresh on 401 responses.
 *
 * This is a **functional interceptor** (Angular 15+ style), using
 * `HttpInterceptorFn` instead of the older class-based `HttpInterceptor`.
 *
 * Flow:
 *   1. Read the JWT token from AuthService's signal (reactive!).
 *   2. Clone the request with `Authorization: Bearer <token>` header.
 *   3. If the server returns 401 and it's NOT a login/refresh request:
 *      a. Try to refresh the token using the stored refresh token.
 *      b. If refresh succeeds → retry the original request with new token.
 *      c. If refresh fails → logout and redirect to login.
 *
 * 📝 Learning note: Interceptors are registered in main.ts via
 *    `provideHttpClient(withInterceptors([authInterceptor]))`.
 *    They wrap EVERY HTTP request your app makes!
 */
import { type HttpInterceptorFn, type HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError, switchMap, from } from 'rxjs';
import { AuthService } from '../services/auth.service.js';
import { Router } from '@angular/router';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const token = authService.token();

  const authReq = token
    ? req.clone({
        setHeaders: { Authorization: `Bearer ${token}` },
      })
    : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (
        error.status === 401 &&
        !req.url.includes('/auth/refresh') &&
        !req.url.includes('/auth/login')
      ) {
        const refreshToken = localStorage.getItem('caregiver_refresh_token');
        if (refreshToken) {
          return from(authService.refreshToken(refreshToken)).pipe(
            switchMap((response) => {
              const newReq = req.clone({
                setHeaders: { Authorization: `Bearer ${response.accessToken}` },
              });
              return next(newReq);
            }),
            catchError(() => {
              authService.logout();
              void router.navigate(['/login']);
              return throwError(() => error);
            }),
          );
        }
        authService.logout();
        void router.navigate(['/login']);
      }
      return throwError(() => error);
    }),
  );
};
