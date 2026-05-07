import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { API_BASE_URL } from '../../../../shared/api/api-base-url.token';
import { policyFromDto, policyToCreateBody } from '../../../../shared/api/mappers';
import type { components } from '../../../../shared/api/schema';
import type { Policy } from '../../domain/entities';
import { PolicyRepository } from '../../domain/ports/policy-repository.port';

type PolicyDto = components['schemas']['PolicyOut'];

@Injectable({ providedIn: 'root' })
export class HttpPolicyRepository extends PolicyRepository {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);
  private readonly _policies = signal<readonly Policy[]>([]);

  /** Public read-only signal — useful to drive computed values when reactivity is needed. */
  readonly policies = this._policies.asReadonly();

  /** Bootstraps the cache from `GET /api/v1/policies`. Call once on auth. */
  async loadAll(): Promise<void> {
    const dtos = await firstValueFrom(
      this.http.get<PolicyDto[]>(`${this.base}/api/v1/policies`),
    );
    this._policies.set(dtos.map(policyFromDto));
  }

  override list(): readonly Policy[] {
    return this._policies();
  }

  override findByNumber(n: string): Policy | undefined {
    return this._policies().find((p) => p.number === n);
  }

  override async create(p: Policy): Promise<Policy> {
    const dto = await firstValueFrom(
      this.http.post<PolicyDto>(`${this.base}/api/v1/policies`, policyToCreateBody(p)),
    );
    const created = policyFromDto(dto);
    this._policies.update((arr) => [...arr, created]);
    return created;
  }

  override async update(p: Policy): Promise<Policy> {
    const dto = await firstValueFrom(
      this.http.put<PolicyDto>(
        `${this.base}/api/v1/policies/${encodeURIComponent(p.number)}`,
        policyToCreateBody(p),
      ),
    );
    const updated = policyFromDto(dto);
    this._policies.update((arr) =>
      arr.map((x) => (x.number === updated.number ? updated : x)),
    );
    return updated;
  }

  override async delete(number: string): Promise<void> {
    await firstValueFrom(
      this.http.delete<void>(`${this.base}/api/v1/policies/${encodeURIComponent(number)}`),
    );
    this._policies.update((arr) => arr.filter((x) => x.number !== number));
  }
}
