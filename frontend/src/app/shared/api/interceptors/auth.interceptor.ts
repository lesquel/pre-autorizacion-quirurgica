import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';

import { TokenStore } from '../../../features/auth/domain/ports/token-store.port';
import { RefreshSessionUseCase } from '../../../features/auth/application/use-cases/refresh-session.use-case';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const store = inject(TokenStore);
  const refreshUC = inject(RefreshSessionUseCase);

  // Don't attach to /auth/login or /auth/refresh — they're the entry points.
  if (req.url.endsWith('/auth/login') || req.url.endsWith('/auth/refresh')) {
    return next(req);
  }

  const tokens = store.get();
  const authed = tokens
    ? req.clone({ setHeaders: { Authorization: `Bearer ${tokens.accessToken}` } })
    : req;

  return next(authed).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401 && tokens) {
        return refreshUC.execute().pipe(
          switchMap((res) =>
            next(
              req.clone({ setHeaders: { Authorization: `Bearer ${res.accessToken}` } }),
            ),
          ),
        );
      }
      return throwError(() => err);
    }),
  );
};
