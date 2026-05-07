import { Injectable, signal } from '@angular/core';

import { SEED } from '../../../../shared/fixtures/seed';
import type { Policy } from '../../domain/entities';
import { PolicyRepository } from '../../domain/ports/policy-repository.port';

/**
 * InMemoryPolicyRepository — adapter del `PolicyRepository` contra el SEED.
 *
 * Almacena las pólizas en un signal mutable seeded del SEED. Sigue siendo
 * útil para tests y como fallback. En runtime el composition root liga
 * `HttpPolicyRepository` al token `PolicyRepository`.
 */
@Injectable({ providedIn: 'root' })
export class InMemoryPolicyRepository extends PolicyRepository {
  private readonly _policies = signal<readonly Policy[]>([...SEED.policies]);

  override list(): readonly Policy[] {
    return this._policies();
  }

  override findByNumber(n: string): Policy | undefined {
    return this._policies().find((p) => p.number === n);
  }

  override create(p: Policy): Promise<Policy> {
    if (this._policies().some((x) => x.number === p.number)) {
      return Promise.reject(new Error(`Policy already exists: ${p.number}`));
    }
    this._policies.update((arr) => [...arr, p]);
    return Promise.resolve(p);
  }

  override update(p: Policy): Promise<Policy> {
    const exists = this._policies().some((x) => x.number === p.number);
    if (!exists) return Promise.reject(new Error(`No policy: ${p.number}`));
    this._policies.update((arr) => arr.map((x) => (x.number === p.number ? p : x)));
    return Promise.resolve(p);
  }

  override delete(number: string): Promise<void> {
    this._policies.update((arr) => arr.filter((x) => x.number !== number));
    return Promise.resolve();
  }
}
