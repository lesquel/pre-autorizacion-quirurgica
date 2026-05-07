import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { API_BASE_URL } from '../../../../shared/api/api-base-url.token';
import { coverageFromDto, coverageToBody } from '../../../../shared/api/mappers';
import type { components } from '../../../../shared/api/schema';
import type { Coverage } from '../../domain/entities';
import { CoverageRepository } from '../../domain/ports/coverage-repository.port';

type CoverageDto = components['schemas']['CoverageOut'];

@Injectable({ providedIn: 'root' })
export class HttpCoverageRepository extends CoverageRepository {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);
  private readonly _coverages = signal<readonly Coverage[]>([]);
  readonly coverages = this._coverages.asReadonly();

  async loadAll(): Promise<void> {
    const dtos = await firstValueFrom(
      this.http.get<CoverageDto[]>(`${this.base}/api/v1/coverages`),
    );
    this._coverages.set(dtos.map(coverageFromDto));
  }

  override list(): readonly Coverage[] {
    return this._coverages();
  }

  override listForPolicy(policyNumber: string): readonly Coverage[] {
    return this._coverages().filter((c) => c.policyNumber === policyNumber);
  }

  override async replaceForPolicy(
    policyNumber: string,
    coverages: readonly Coverage[],
  ): Promise<readonly Coverage[]> {
    const dtos = await firstValueFrom(
      this.http.put<CoverageDto[]>(
        `${this.base}/api/v1/policies/${encodeURIComponent(policyNumber)}/coverages`,
        coverages.map(coverageToBody),
      ),
    );
    const next = dtos.map(coverageFromDto);
    this._coverages.update((arr) => [
      ...arr.filter((c) => c.policyNumber !== policyNumber),
      ...next,
    ]);
    return next;
  }
}
