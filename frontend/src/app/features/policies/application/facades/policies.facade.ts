import { Injectable, computed, inject } from '@angular/core';

import type { Coverage, Insurer, Policy } from '../../domain/entities';
import {
  CreatePolicyUseCase,
  DeletePolicyUseCase,
  GetDashboardMetricsUseCase,
  ListCoveragesUseCase,
  ListInsurersUseCase,
  ListPoliciesUseCase,
  UpdatePolicyUseCase,
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
 * - `createPolicy`, `updatePolicy`, `deletePolicy`: delegados a sus use cases
 *   correspondientes. `createCoverage` permanece como stub hasta Task 17.
 */
@Injectable({ providedIn: 'root' })
export class PoliciesFacade {
  private readonly listPolicies = inject(ListPoliciesUseCase);
  private readonly listCoverages = inject(ListCoveragesUseCase);
  private readonly listInsurers = inject(ListInsurersUseCase);
  private readonly getDashboardMetrics = inject(GetDashboardMetricsUseCase);
  private readonly createPolicyUC = inject(CreatePolicyUseCase);
  private readonly updatePolicyUC = inject(UpdatePolicyUseCase);
  private readonly deletePolicyUC = inject(DeletePolicyUseCase);

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

  createPolicy(p: Policy): Promise<Policy> {
    return this.createPolicyUC.execute(p);
  }

  updatePolicy(p: Policy): Promise<Policy> {
    return this.updatePolicyUC.execute(p);
  }

  deletePolicy(number: string): Promise<void> {
    return this.deletePolicyUC.execute(number);
  }

  createCoverage(): never {
    throw new Error(
      'Coverage CRUD coming soon — MVP es read-only (decisión D2 del PRD).',
    );
  }
}
