import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { authInterceptor } from './shared/api/interceptors/auth.interceptor';
import { errorInterceptor } from './shared/api/interceptors/error.interceptor';
import { AuthRepository } from './features/auth/domain/ports/auth-repository.port';
import { TokenStore } from './features/auth/domain/ports/token-store.port';
import { HttpAuthRepository } from './features/auth/infrastructure/repos/http-auth.repository';
import { InMemoryTokenStore } from './features/auth/infrastructure/stores/in-memory-token.store';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor, errorInterceptor])),
    { provide: AuthRepository, useClass: HttpAuthRepository },
    { provide: TokenStore, useClass: InMemoryTokenStore },
  ],
};
