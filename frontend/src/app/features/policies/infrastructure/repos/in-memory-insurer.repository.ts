import { Injectable } from '@angular/core';

import { SEED } from '../../../../shared/fixtures/seed';
import type { Insurer } from '../../domain/entities';
import { InsurerRepository } from '../../domain/ports/insurer-repository.port';

/**
 * InMemoryInsurerRepository — adapter del `InsurerRepository` contra el SEED.
 *
 * En MVP el catálogo tiene una única aseguradora (INS-ANDINA). El contrato
 * mantiene `list()` para que la UI no quede acoplada a esa cardinalidad.
 */
@Injectable({ providedIn: 'root' })
export class InMemoryInsurerRepository extends InsurerRepository {
  override list(): readonly Insurer[] {
    return SEED.insurers;
  }

  override findById(id: string): Insurer | undefined {
    return SEED.insurers.find((i) => i.id === id);
  }
}
