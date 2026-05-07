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

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor, errorInterceptor])),
    { provide: AuthRepository, useClass: HttpAuthRepository },
    { provide: TokenStore, useClass: InMemoryTokenStore },
    { provide: CaseRepository, useClass: HttpCaseRepository },
    { provide: AgentOrchestrator, useClass: HttpAgentAdapter },
    { provide: PolicyRepository, useClass: HttpPolicyRepository },
    { provide: CoverageRepository, useClass: HttpCoverageRepository },
    { provide: InsurerRepository, useClass: HttpInsurerRepository },
    { provide: ProcedureRepository, useClass: HttpProcedureRepository },
  ],
};
