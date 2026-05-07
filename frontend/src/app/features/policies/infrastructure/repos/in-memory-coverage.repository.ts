import { Injectable, signal } from '@angular/core';

import { SEED } from '../../../../shared/fixtures/seed';
import type { Coverage } from '../../domain/entities';
import { CoverageRepository } from '../../domain/ports/coverage-repository.port';

/**
 * InMemoryCoverageRepository — adapter del `CoverageRepository` contra el SEED.
 *
 * Almacena las coberturas en un signal mutable seeded del SEED. Sigue siendo
 * útil para tests y como fallback. En runtime el composition root liga
 * `HttpCoverageRepository` al token `CoverageRepository`.
 */
@Injectable({ providedIn: 'root' })
export class InMemoryCoverageRepository extends CoverageRepository {
  private readonly _coverages = signal<readonly Coverage[]>([...SEED.coverages]);

  override list(): readonly Coverage[] {
    return this._coverages();
  }

  override listForPolicy(policyNumber: string): readonly Coverage[] {
    return this._coverages().filter((c) => c.policyNumber === policyNumber);
  }

  override replaceForPolicy(
    policyNumber: string,
    coverages: readonly Coverage[],
  ): Promise<readonly Coverage[]> {
    const kept = this._coverages().filter((c) => c.policyNumber !== policyNumber);
    const next = coverages.filter((c) => c.policyNumber === policyNumber);
    this._coverages.set([...kept, ...next]);
    return Promise.resolve(next);
  }
}
