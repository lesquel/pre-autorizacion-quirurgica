import { inject, Injectable } from '@angular/core';

import type { Role } from '../../../../core/types/role';
import type { AuthorizationCase } from '../../domain/entities/authorization-case';
import { CaseRepository } from '../../domain/ports/case-repository.port';
import type { CaseStatus } from '../../domain/value-objects/case-status';

/**
 * ListCasesFilter — filtro opcional aplicado por el use case.
 *
 * - `role`   : filtra por visibilidad según rol.
 *              - 'auditor' : sólo `ESCALADO` o `DECIDIDO`.
 *              - 'insurer' : todos.
 *              - 'hospital': todos (en MVP no diferenciamos hospitales).
 * - `status` : si viene, filtra adicionalmente por status exacto.
 */
export interface ListCasesFilter {
  readonly role?: Role;
  readonly status?: CaseStatus;
}

/**
 * ListCasesUseCase — devuelve la lista de casos visible para un rol/status.
 *
 * Lee el snapshot del repo (no es reactivo). Si la UI necesita reactividad,
 * la facade arma un computed encima del signal `cases`.
 */
@Injectable({ providedIn: 'root' })
export class ListCasesUseCase {
  private readonly repository = inject(CaseRepository);

  execute(filter?: ListCasesFilter): readonly AuthorizationCase[] {
    let cases = this.repository.listSnapshot();

    if (filter?.role) {
      cases = filterByRole(cases, filter.role);
    }

    if (filter?.status) {
      const status = filter.status;
      cases = cases.filter((c) => c.status === status);
    }

    return cases;
  }
}

export function filterByRole(
  cases: readonly AuthorizationCase[],
  role: Role,
): readonly AuthorizationCase[] {
  switch (role) {
    case 'auditor':
      return cases.filter(
        (c) => c.status === 'ESCALADO' || c.status === 'DECIDIDO',
      );
    case 'insurer':
    case 'hospital':
      return cases;
  }
}
