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
      if (error.status === 401 && !req.url.includes('/auth/refresh') && !req.url.includes('/auth/login')) {
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