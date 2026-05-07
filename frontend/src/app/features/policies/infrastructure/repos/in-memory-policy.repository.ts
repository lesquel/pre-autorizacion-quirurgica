import { Injectable } from '@angular/core';

import { SEED } from '../../../../shared/fixtures/seed';
import type { Policy } from '../../domain/entities';
import { PolicyRepository } from '../../domain/ports/policy-repository.port';

/**
 * InMemoryPolicyRepository — adapter del `PolicyRepository` contra el SEED.
 *
 * En MVP las pólizas son read-only (decisión D2 del PRD: stubs "coming soon"
 * en la vista de Policies). Por eso el adapter sólo lee del SEED y no expone
 * mutaciones — cuando llegue el backend real se reemplaza por un
 * `HttpPolicyRepository` sin cambiar el contrato.
 */
@Injectable({ providedIn: 'root' })
export class InMemoryPolicyRepository extends PolicyRepository {
  override list(): readonly Policy[] {
    return SEED.policies;
  }

  override findByNumber(n: string): Policy | undefined {
    return SEED.policies.find((p) => p.number === n);
  }
}
