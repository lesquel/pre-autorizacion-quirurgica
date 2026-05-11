import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { authInterceptor } from './shared/api/interceptors/auth.interceptor';
import { errorInterceptor } from './shared/api/interceptors/error.interceptor';
import { AuthRepository } from './features/auth/domain/ports/auth-repository.port';
import { TokenStore } from './features/auth/domain/ports/token-store.port';
import { HttpAuthRepository } from './features/auth/infrastructure/repos/http-auth.repository';
import { SessionStorageTokenStore } from './features/auth/infrastructure/stores/session-storage-token.store';
import { AgentOrchestrator } from './features/authorization-cases/domain/ports/agent-orchestrator.port';
import { CaseRepository } from './features/authorization-cases/domain/ports/case-repository.port';
import { HttpAgentAdapter } from './features/authorization-cases/infrastructure/agents/http-agent.adapter';
import { HttpCaseRepository } from './features/authorization-cases/infrastructure/repos/http-case.repository';
import { PolicyRepository } from './features/policies/domain/ports/policy-repository.port';
import { CoverageRepository } from './features/policies/domain/ports/coverage-repository.port';
import { InsurerRepository } from './features/policies/domain/ports/insurer-repository.port';
import { HttpPolicyRepository } from './features/policies/infrastructure/repos/http-policy.repository';
import { HttpCoverageRepository } from './features/policies/infrastructure/repos/http-coverage.repository';
import { HttpInsurerRepository } from './features/policies/infrastructure/repos/http-insurer.repository';
import { ProcedureRepository } from './shared/domain/ports/procedure-repository.port';
import { HttpProcedureRepository } from './shared/infrastructure/repos/http-procedure.repository';

/**
 * Composition root.
 *
 * Para los repos HTTP usamos `useExisting` en vez de `useClass`. Razón:
 * las clases concretas ya están registradas como providers globales vía
 * `@Injectable({ providedIn: 'root' })`. Si además declaráramos
 * `{ provide: AbstractPort, useClass: HttpImpl }` Angular crearía DOS
 * instancias — una para `HttpImpl` y otra para `AbstractPort` — y los
 * signals internos divergirían (un consumer que inyecte la clase concreta
 * vería un signal, otro que inyecte el port abstracto vería otro distinto).
 *
 * Con `useExisting`, el token abstracto resuelve a la MISMA instancia que
 * la clase concreta. Eso garantiza que cualquier `loadAll()` invocado vía
 * la clase concreta (ej. en `App` para bootstrap) actualice el signal que
 * los use cases / facades leen vía el port abstracto.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor, errorInterceptor])),
    { provide: AuthRepository, useExisting: HttpAuthRepository },
    { provide: TokenStore, useExisting: SessionStorageTokenStore },
    { provide: CaseRepository, useExisting: HttpCaseRepository },
    { provide: AgentOrchestrator, useExisting: HttpAgentAdapter },
    { provide: PolicyRepository, useExisting: HttpPolicyRepository },
    { provide: CoverageRepository, useExisting: HttpCoverageRepository },
    { provide: InsurerRepository, useExisting: HttpInsurerRepository },
    { provide: ProcedureRepository, useExisting: HttpProcedureRepository },
  ],
};
