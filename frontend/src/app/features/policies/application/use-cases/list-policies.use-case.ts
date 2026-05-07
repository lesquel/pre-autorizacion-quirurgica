import { Injectable, inject } from '@angular/core';

import type { Policy } from '../../domain/entities';
import { PolicyRepository } from '../../domain/ports/policy-repository.port';

/**
 * ListPoliciesUseCase — devuelve todas las pólizas conocidas.
 *
 * Wrapper finísimo sobre el repositorio: existe para que la facade dependa de
 * un caso de uso y no del port directamente, manteniendo la regla de que el
 * dominio define el contrato y la application layer orquesta.
 */
@Injectable({ providedIn: 'root' })
export class ListPoliciesUseCase {
  private readonly repository = inject(PolicyRepository);

  execute(): readonly Policy[] {
    return this.repository.list();
  }
}
