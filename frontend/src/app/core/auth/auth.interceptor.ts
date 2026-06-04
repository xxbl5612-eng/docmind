import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = localStorage.getItem('access_token');

  if (token && !req.url.includes('/auth/refresh')) {
    req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !req.url.includes('/auth/refresh')) {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          return authService.refreshToken(refreshToken).pipe(
            switchMap((res) => {
              if (res.success && res.data) {
                localStorage.setItem('access_token', res.data.access_token);
                localStorage.setItem('refresh_token', res.data.refresh_token);
                const retryReq = req.clone({
                  setHeaders: { Authorization: `Bearer ${res.data.access_token}` },
                });
                return next(retryReq);
              }
              authService.logout();
              return throwError(() => error);
            }),
            catchError(() => {
              authService.logout();
              return throwError(() => error);
            })
          );
        }
        authService.logout();
      }
      return throwError(() => error);
    })
  );
};
