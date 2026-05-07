import { Injectable, inject } from '@angular/core';

import type { Coverage } from '../../domain/entities';
import { CoverageRepository } from '../../domain/ports/coverage-repository.port';

@Injectable({ providedIn: 'root' })
export class ReplaceCoveragesUseCase {
  private readonly repo = inject(CoverageRepository);
  execute(
    policyNumber: string,
    coverages: readonly Coverage[],
  ): Promise<readonly Coverage[]> {
    return this.repo.replaceForPolicy(policyNumber, coverages);
  }
}
