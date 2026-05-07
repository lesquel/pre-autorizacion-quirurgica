import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

import { ApiError } from '../errors/api-error';

export const errorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse) {
        const body = err.error ?? {};
        const message = body?.detail ?? body?.title ?? err.message ?? 'Request failed';
        return throwError(
          () =>
            new ApiError(
              err.status,
              message,
              body?.title,
              body?.detail,
              err.headers.get('x-request-id') ?? undefined,
            ),
        );
      }
      return throwError(() => err);
    }),
  );
