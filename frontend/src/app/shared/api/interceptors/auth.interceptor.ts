import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';

import { TokenStore } from '../../../features/auth/domain/ports/token-store.port';
import { RefreshSessionUseCase } from '../../../features/auth/application/use-cases/refresh-session.use-case';

const SKIP_PATHS = ['/auth/login', '/auth/refresh', '/auth/logout'] as const;
const RETRY_HEADER = 'X-Auth-Retry';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const store = inject(TokenStore);
  const refreshUC = inject(RefreshSessionUseCase);
  const router = inject(Router);

  if (SKIP_PATHS.some((p) => req.url.endsWith(p))) {
    return next(req);
  }

  const tokens = store.get();
  const authed = tokens
    ? req.clone({ setHeaders: { Authorization: `Bearer ${tokens.accessToken}` } })
    : req;

  return next(authed).pipe(
    catchError((err: unknown) => {
      if (
        err instanceof HttpErrorResponse &&
        err.status === 401 &&
        tokens &&
        !req.headers.has(RETRY_HEADER)
      ) {
        return refreshUC.execute().pipe(
          switchMap((res) =>
            next(
              req.clone({
                setHeaders: {
                  Authorization: `Bearer ${res.accessToken}`,
                  [RETRY_HEADER]: '1',
                },
              }),
            ),
          ),
          catchError((refreshErr: unknown) => {
            // Refresh itself failed — clear tokens and bounce to /login.
            store.clear();
            void router.navigate(['/login']);
            return throwError(() => refreshErr);
          }),
        );
      }
      return throwError(() => err);
    }),
  );
};
