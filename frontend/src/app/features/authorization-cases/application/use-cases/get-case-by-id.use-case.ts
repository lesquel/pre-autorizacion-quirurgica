import { inject, Injectable } from '@angular/core';

import type { AuthorizationCase } from '../../domain/entities/authorization-case';
import { CaseRepository } from '../../domain/ports/case-repository.port';

/**
 * GetCaseByIdUseCase — obtiene un caso por id (snapshot).
 *
 * Devuelve `undefined` si no existe. La facade arma un computed encima del
 * signal `cases` para reactividad (este use case sólo expone el snapshot).
 */
@Injectable({ providedIn: 'root' })
export class GetCaseByIdUseCase {
  private readonly repository = inject(CaseRepository);

  execute(id: string): AuthorizationCase | undefined {
    return this.repository.findById(id);
  }
}
