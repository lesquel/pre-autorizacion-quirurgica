import { Injectable, inject } from '@angular/core';

import type { Coverage } from '../../domain/entities';
import { CoverageRepository } from '../../domain/ports/coverage-repository.port';

/**
 * ListCoveragesUseCase — lista coberturas, opcionalmente filtradas por póliza.
 *
 * Si `policyNumber` se omite devuelve todas las coberturas (vista global).
 * Si se provee, delega en `listForPolicy` del repositorio.
 */
@Injectable({ providedIn: 'root' })
export class ListCoveragesUseCase {
  private readonly repository = inject(CoverageRepository);

  execute(policyNumber?: string): readonly Coverage[] {
    if (policyNumber === undefined) {
      return this.repository.list();
    }
    return this.repository.listForPolicy(policyNumber);
  }
}
