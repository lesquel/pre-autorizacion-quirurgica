import { Injectable, inject } from '@angular/core';

import type { AuthorizationCase } from '../../../authorization-cases/domain/entities/authorization-case';
import { CaseRepository } from '../../../authorization-cases/domain/ports/case-repository.port';

/**
 * DashboardMetrics — agregados que muestra el dashboard de la Aseguradora.
 *
 * Convención numérica:
 * - `autoApprovedPct` ∈ [0, 100] (porcentaje, no fracción).
 * - `avgConfidence`   ∈ [0, 1]   (sólo casos con `decision`).
 * - `avgDurationMs`   en milisegundos del último step de cada `agentTrace`.
 *
 * Si el conjunto de casos es vacío, devolvemos ceros sin dividir — la UI
 * decide si renderiza placeholder o no.
 */
export interface DashboardMetrics {
  readonly total: number;
  readonly autoApproved: number;
  readonly docsRequested: number;
  readonly escalated: number;
  readonly decided: number;
  readonly autoApprovedPct: number;
  readonly avgConfidence: number;
  readonly avgDurationMs: number;
}

const EMPTY_METRICS: DashboardMetrics = {
  total: 0,
  autoApproved: 0,
  docsRequested: 0,
  escalated: 0,
  decided: 0,
  autoApprovedPct: 0,
  avgConfidence: 0,
  avgDurationMs: 0,
};

/**
 * GetDashboardMetricsUseCase — calcula los agregados a partir del repositorio
 * de casos.
 *
 * IMPORTANTE: lee `caseRepository.cases()` (signal) y NO `listSnapshot()`. Esto
 * permite que un `computed` que envuelva a `execute()` se invalide cuando se
 * agreguen o muten casos, alimentando el dashboard reactivo.
 */
@Injectable({ providedIn: 'root' })
export class GetDashboardMetricsUseCase {
  private readonly caseRepository = inject(CaseRepository);

  execute(): DashboardMetrics {
    // Lectura reactiva: si esto se invoca dentro de un `computed`, el cambio
    // del signal `cases` invalida el cómputo automáticamente.
    const cases = this.caseRepository.cases();
    if (cases.length === 0) {
      return EMPTY_METRICS;
    }

    const counters = countByStatus(cases);
    const total = cases.length;

    const autoApprovedPct =
      total > 0 ? (counters.autoApproved / total) * 100 : 0;

    const avgConfidence = averageConfidence(cases);
    const avgDurationMs = averageLastStepDuration(cases);

    return {
      total,
      autoApproved: counters.autoApproved,
      docsRequested: counters.docsRequested,
      escalated: counters.escalated,
      decided: counters.decided,
      autoApprovedPct,
      avgConfidence,
      avgDurationMs,
    };
  }
}

interface StatusCounters {
  autoApproved: number;
  docsRequested: number;
  escalated: number;
  decided: number;
}

function countByStatus(
  cases: readonly AuthorizationCase[],
): StatusCounters {
  const counters: StatusCounters = {
    autoApproved: 0,
    docsRequested: 0,
    escalated: 0,
    decided: 0,
  };
  for (const c of cases) {
    switch (c.status) {
      case 'APROBADO_AUTO':
        counters.autoApproved += 1;
        break;
      case 'DOCS_PEDIDOS':
        counters.docsRequested += 1;
        break;
      case 'ESCALADO':
        counters.escalated += 1;
        break;
      case 'DECIDIDO':
        counters.decided += 1;
        break;
      // PENDIENTE no entra en ningún bucket — se considera "en curso".
      default:
        break;
    }
  }
  return counters;
}

function averageConfidence(cases: readonly AuthorizationCase[]): number {
  let sum = 0;
  let n = 0;
  for (const c of cases) {
    if (c.decision !== undefined) {
      sum += c.decision.confidence;
      n += 1;
    }
  }
  return n === 0 ? 0 : sum / n;
}

function averageLastStepDuration(
  cases: readonly AuthorizationCase[],
): number {
  let sum = 0;
  let n = 0;
  for (const c of cases) {
    const trace = c.agentTrace;
    if (trace.length === 0) continue;
    const last = trace[trace.length - 1];
    if (last.durationMs === undefined) continue;
    sum += last.durationMs;
    n += 1;
  }
  return n === 0 ? 0 : sum / n;
}
