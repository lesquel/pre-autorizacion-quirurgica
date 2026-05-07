import { Injectable, inject } from '@angular/core';

import { PolicyRepository } from '../../domain/ports/policy-repository.port';

@Injectable({ providedIn: 'root' })
export class DeletePolicyUseCase {
  private readonly repo = inject(PolicyRepository);
  execute(number: string): Promise<void> {
    return this.repo.delete(number);
  }
}
