import { Injectable } from '@angular/core';

import { SEED } from '../../../../shared/fixtures/seed';
import type { Coverage } from '../../domain/entities';
import { CoverageRepository } from '../../domain/ports/coverage-repository.port';

/**
 * InMemoryCoverageRepository — adapter del `CoverageRepository` contra el SEED.
 *
 * `listForPolicy` resuelve por filtro lineal sobre el SEED (n pequeño en MVP).
 * Cuando se necesite scale, el adapter HTTP puede indexar por `policyNumber`.
 */
@Injectable({ providedIn: 'root' })
export class InMemoryCoverageRepository extends CoverageRepository {
  override list(): readonly Coverage[] {
    return SEED.coverages;
  }

  override listForPolicy(policyNumber: string): readonly Coverage[] {
    return SEED.coverages.filter((c) => c.policyNumber === policyNumber);
  }
}
