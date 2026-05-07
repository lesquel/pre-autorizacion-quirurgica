import { Injectable, inject } from '@angular/core';

import type { Insurer } from '../../domain/entities';
import { InsurerRepository } from '../../domain/ports/insurer-repository.port';

/**
 * ListInsurersUseCase — devuelve el catálogo de aseguradoras conocidas.
 */
@Injectable({ providedIn: 'root' })
export class ListInsurersUseCase {
  private readonly repository = inject(InsurerRepository);

  execute(): readonly Insurer[] {
    return this.repository.list();
  }
}
