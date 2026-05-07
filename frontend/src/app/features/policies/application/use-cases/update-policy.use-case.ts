import { Injectable, inject } from '@angular/core';

import type { Policy } from '../../domain/entities';
import { PolicyRepository } from '../../domain/ports/policy-repository.port';

@Injectable({ providedIn: 'root' })
export class UpdatePolicyUseCase {
  private readonly repo = inject(PolicyRepository);
  execute(p: Policy): Promise<Policy> {
    return this.repo.update(p);
  }
}
