import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { API_BASE_URL } from '../../api/api-base-url.token';
import { procedureFromDto, procedureToBody } from '../../api/mappers';
import type { components } from '../../api/schema';
import type { Procedure } from '../../domain/entities/procedure';
import { ProcedureRepository } from '../../domain/ports/procedure-repository.port';

type ProcedureDto = components['schemas']['ProcedureOut'];

@Injectable({ providedIn: 'root' })
export class HttpProcedureRepository extends ProcedureRepository {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);
  private readonly _procedures = signal<readonly Procedure[]>([]);
  readonly procedures = this._procedures.asReadonly();

  override async list(): Promise<readonly Procedure[]> {
    const dtos = await firstValueFrom(
      this.http.get<ProcedureDto[]>(`${this.base}/api/v1/procedures`),
    );
    const next = dtos.map(procedureFromDto);
    this._procedures.set(next);
    return next;
  }

  override async search(query: string): Promise<readonly Procedure[]> {
    const params = new HttpParams().set('q', query);
    const dtos = await firstValueFrom(
      this.http.get<ProcedureDto[]>(`${this.base}/api/v1/procedures`, { params }),
    );
    return dtos.map(procedureFromDto);
  }

  override async create(p: Procedure): Promise<Procedure> {
    const dto = await firstValueFrom(
      this.http.post<ProcedureDto>(`${this.base}/api/v1/procedures`, procedureToBody(p)),
    );
    const created = procedureFromDto(dto);
    this._procedures.update((arr) => [...arr, created]);
    return created;
  }

  override async update(p: Procedure): Promise<Procedure> {
    const dto = await firstValueFrom(
      this.http.put<ProcedureDto>(
        `${this.base}/api/v1/procedures/${encodeURIComponent(p.code)}`,
        procedureToBody(p),
      ),
    );
    const updated = procedureFromDto(dto);
    this._procedures.update((arr) =>
      arr.map((x) => (x.code === updated.code ? updated : x)),
    );
    return updated;
  }

  override async delete(code: string): Promise<void> {
    await firstValueFrom(
      this.http.delete<void>(`${this.base}/api/v1/procedures/${encodeURIComponent(code)}`),
    );
    this._procedures.update((arr) => arr.filter((x) => x.code !== code));
  }
}
