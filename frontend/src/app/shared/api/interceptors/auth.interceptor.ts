import { type HttpInterceptorFn } from '@angular/common/http';

/**
 * AuthInterceptor — attaches the bearer token to outbound requests.
 * The full implementation (with refresh-on-401) lands in Task 11 once the
 * AuthFacade exists.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => next(req);
