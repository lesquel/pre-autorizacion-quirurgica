import { Injectable, computed, inject } from '@angular/core';

import type { Coverage, Insurer, Policy } from '../../domain/entities';
import {
  GetDashboardMetricsUseCase,
  ListCoveragesUseCase,
  ListInsurersUseCase,
  ListPoliciesUseCase,
  type DashboardMetrics,
} from '../use-cases';

/**
 * PoliciesFacade — fachada signal-based del feature `policies`.
 *
 * Contrato:
 * - `policies`, `coverages`, `insurers`: signals computed que envuelven los
 *   use cases de listado. Como las listas viven en el SEED (estático) no
 *   reaccionan a nada, pero se exponen como `Signal` para uniformidad con la
 *   UI y para soportar adapters dinámicos en el futuro.
 * - `metrics`: signal computed que SÍ reacciona — el use case lee
 *   `caseRepository.cases()` (signal), por lo tanto el computed se invalida
 *   cuando se crean/mutan casos. Esto es lo que mantiene el dashboard vivo
 *   durante el demo.
 *
 * MVP — decisión D2 del PRD: las vistas de Policies y Coverages son stubs
 * "coming soon". Por eso los métodos de mutación tiran un Error explícito
 * en vez de mutar un repositorio: cualquier intento de invocarlos en runtime
 * delata un bug en la UI antes de que se mezcle estado inconsistente.
 */
@Injectable({ providedIn: 'root' })
export class PoliciesFacade {
  private readonly listPolicies = inject(ListPoliciesUseCase);
  private readonly listCoverages = inject(ListCoveragesUseCase);
  private readonly listInsurers = inject(ListInsurersUseCase);
  private readonly getDashboardMetrics = inject(GetDashboardMetricsUseCase);

  /** Todas las pólizas conocidas. */
  readonly policies = computed<readonly Policy[]>(() =>
    this.listPolicies.execute(),
  );

  /** Todas las coberturas (vista global, sin filtrar por póliza). */
  readonly coverages = computed<readonly Coverage[]>(() =>
    this.listCoverages.execute(),
  );

  /** Catálogo de aseguradoras. */
  readonly insurers = computed<readonly Insurer[]>(() =>
    this.listInsurers.execute(),
  );

  /**
   * Métricas del dashboard de Aseguradora.
   *
   * Reactivo: el use case lee `caseRepository.cases()` (signal), por lo que
   * cuando un nuevo caso se crea o se actualiza el computed se recalcula
   * automáticamente y la UI del dashboard se refresca sin código extra.
   */
  readonly metrics = computed<DashboardMetrics>(() =>
    this.getDashboardMetrics.execute(),
  );

  /**
   * Coberturas asociadas a una póliza puntual.
   * Helper síncrono — no es un signal porque depende de un argumento.
   */
  coveragesForPolicy(n: string): readonly Coverage[] {
    return this.listCoverages.execute(n);
  }

  // ---------------------------------------------------------------------------
  // Stubs MVP (decisión D2 del PRD: Policies/Coverages son read-only).
  // ---------------------------------------------------------------------------
  // Elegimos `throw` (no `console.warn`) a propósito: si la UI llama a esto en
  // el MVP es un bug — preferimos que falle ruidosamente en dev/demo a que
  // pase silenciosamente y deje un estado fantasma. El mensaje queda en
  // español para que en el demo no haya ambigüedad sobre el alcance.

  createPolicy(): never {
    throw new Error(
      'Policy CRUD coming soon — MVP es read-only (decisión D2 del PRD).',
    );
  }

  updatePolicy(): never {
    throw new Error(
      'Policy CRUD coming soon — MVP es read-only (decisión D2 del PRD).',
    );
  }

  deletePolicy(): never {
    throw new Error(
      'Policy CRUD coming soon — MVP es read-only (decisión D2 del PRD).',
    );
  }

  createCoverage(): never {
    throw new Error(
      'Coverage CRUD coming soon — MVP es read-only (decisión D2 del PRD).',
    );
  }
}
