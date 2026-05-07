import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { API_BASE_URL } from '../../../../shared/api/api-base-url.token';
import { insurerFromDto } from '../../../../shared/api/mappers';
import type { components } from '../../../../shared/api/schema';
import type { Insurer } from '../../domain/entities';
import { InsurerRepository } from '../../domain/ports/insurer-repository.port';

type InsurerDto = components['schemas']['InsurerOut'];

@Injectable({ providedIn: 'root' })
export class HttpInsurerRepository extends InsurerRepository {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);
  private readonly _insurers = signal<readonly Insurer[]>([]);
  readonly insurers = this._insurers.asReadonly();

  async loadAll(): Promise<void> {
    const dtos = await firstValueFrom(
      this.http.get<InsurerDto[]>(`${this.base}/api/v1/insurers`),
    );
    this._insurers.set(dtos.map(insurerFromDto));
  }

  override list(): readonly Insurer[] {
    return this._insurers();
  }

  override findById(id: string): Insurer | undefined {
    return this._insurers().find((i) => i.id === id);
  }
}
