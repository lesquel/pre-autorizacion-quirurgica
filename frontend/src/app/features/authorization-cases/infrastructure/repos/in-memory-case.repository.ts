import { Injectable, signal } from '@angular/core';

import { INITIAL_CASES } from '../../../../shared/fixtures/initial-cases';
import type { AuthorizationCase } from '../../domain/entities/authorization-case';
import { CaseRepository } from '../../domain/ports/case-repository.port';
import type { TraceStep } from '../../domain/value-objects/trace-step';

/**
 * InMemoryCaseRepository — adapter en memoria para el `CaseRepository`.
 *
 * Estado en un `signal` privado, expuesto como readonly. Toda mutación es
 * inmutable: `signal.update(arr => [...arr, item])` para create, y
 * spread por elemento para update. La UI consume `cases` como signal y
 * reacciona automáticamente.
 *
 * En el MVP arranca sembrado con `INITIAL_CASES` (7 casos del prototipo).
 * Cuando llegue el backend real, esta clase se reemplaza por un
 * `HttpCaseRepository` que mapea desde DTOs — el contrato del port queda igual.
 */
@Injectable({ providedIn: 'root' })
export class InMemoryCaseRepository extends CaseRepository {
  private readonly _cases = signal<readonly AuthorizationCase[]>([
    ...INITIAL_CASES,
  ]);

  override readonly cases = this._cases.asReadonly();

  /**
   * No-op por construcción: el adapter en memoria ya tiene la lista
   * sembrada en el signal, no hay un origen externo que recargar. El
   * contrato del port pide `loadAll` para que adapters HTTP puedan
   * refrescar tras un POST sin castear a la clase concreta (LSP).
   */
  override loadAll(): Promise<void> {
    return Promise.resolve();
  }

  override listSnapshot(): readonly AuthorizationCase[] {
    return this._cases();
  }

  override findById(id: string): AuthorizationCase | undefined {
    return this._cases().find((c) => c.id === id);
  }

  override create(case_: AuthorizationCase): void {
    this._cases.update((arr) => [...arr, case_]);
  }

  override update(id: string, patch: Partial<AuthorizationCase>): void {
    this._cases.update((arr) =>
      arr.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );
  }

  /**
   * En memoria la traza ya viaja embebida en `AuthorizationCase.agentTrace`,
   * así que devolvemos eso. Mantiene el contrato del port sin pegar a HTTP.
   */
  override async loadTrace(caseId: string): Promise<readonly TraceStep[]> {
    return this.findById(caseId)?.agentTrace ?? [];
  }
}
