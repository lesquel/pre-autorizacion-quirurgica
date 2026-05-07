import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { API_BASE_URL } from '../../../../shared/api/api-base-url.token';
import { caseFromDto, traceStepFromDto } from '../../../../shared/api/mappers';
import type { components } from '../../../../shared/api/schema';
import type { AuthorizationCase } from '../../domain/entities/authorization-case';
import type { TraceStep } from '../../domain/value-objects/trace-step';
import { CaseRepository } from '../../domain/ports/case-repository.port';

type CaseDto = components['schemas']['CaseOut'];

@Injectable({ providedIn: 'root' })
export class HttpCaseRepository extends CaseRepository {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);
  private readonly _cases = signal<readonly AuthorizationCase[]>([]);
  override readonly cases = this._cases.asReadonly();

  async loadAll(): Promise<void> {
    const dtos = await firstValueFrom(
      this.http.get<CaseDto[]>(`${this.base}/api/v1/cases`),
    );
    this._cases.set(dtos.map(caseFromDto));
  }

  override listSnapshot(): readonly AuthorizationCase[] {
    return this._cases();
  }

  override findById(id: string): AuthorizationCase | undefined {
    return this._cases().find((c) => c.id === id);
  }

  override create(c: AuthorizationCase): void {
    this._cases.update((arr) => [...arr, c]);
  }

  override update(id: string, patch: Partial<AuthorizationCase>): void {
    this._cases.update((arr) => arr.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  /** Extra: fetch the trace steps for a case (used by the agent adapter). */
  async getTrace(id: string): Promise<readonly TraceStep[]> {
    const body = await firstValueFrom(
      this.http.get<{ trace: unknown[] }>(
        `${this.base}/api/v1/cases/${encodeURIComponent(id)}/trace`,
      ),
    );
    return body.trace.map((s) => traceStepFromDto(s as never));
  }
}
