import { inject, Injectable } from '@angular/core';
import { type Observable, of, share, tap } from 'rxjs';

import { findCoverage, findPolicy } from '../../../../shared/domain/helpers/finders';
import { SEED } from '../../../../shared/fixtures/seed';
import type { AuthorizationCase } from '../../domain/entities/authorization-case';
import type { MedicalReport } from '../../domain/entities/medical-report';
import type { AgentEvent } from '../../domain/ports/agent-orchestrator.port';
import { AgentOrchestrator } from '../../domain/ports/agent-orchestrator.port';
import { CaseRepository } from '../../domain/ports/case-repository.port';
import type { CaseStatus } from '../../domain/value-objects/case-status';
import type { Outcome } from '../../domain/value-objects/outcome';
import type { TraceStep } from '../../domain/value-objects/trace-step';

/**
 * SubmitCaseInput — payload del flujo de pre-autorización.
 *
 * - `report`       : informe médico ya construido (entity).
 * - `policyNumber` : número de póliza presentada por el hospital.
 * - `scenarioKey`  : (opcional) override determinístico para demos.
 *                    Si viene, el agente NO infiere y usa este escenario.
 */
export interface SubmitCaseInput {
  readonly report: MedicalReport;
  readonly policyNumber: string;
  readonly scenarioKey?: string;
}

/**
 * SubmitCaseUseCase — orquesta el envío de un caso nuevo:
 *
 *   1. Resuelve póliza y cobertura (SEED) — si falta alguna, emite `error` y termina.
 *   2. Crea el caso en `PENDIENTE` con traza vacía.
 *   3. Persiste el caso en el repo.
 *   4. Corre el agente y va updating la traza acumulada en cada `step`.
 *   5. Al `done`, mapea el outcome del agente al `CaseStatus` y persiste decision.
 *   6. Al `error`, marca el caso como `ESCALADO` (NUNCA auto-rechaza — política PRD).
 *
 * Devuelve el Observable original (con `share()`) para que la facade y la UI
 * puedan suscribirse al mismo stream sin re-ejecutar el agente.
 */
@Injectable({ providedIn: 'root' })
export class SubmitCaseUseCase {
  private readonly repository = inject(CaseRepository);
  private readonly agent = inject(AgentOrchestrator);

  execute(input: SubmitCaseInput): {
    readonly caseId: string;
    readonly events$: Observable<AgentEvent>;
  } {
    const caseId = generateCaseId();

    const policy = findPolicy(input.policyNumber, SEED.policies);
    const coverage = policy
      ? findCoverage(
          {
            policyNumber: input.policyNumber,
            procedureCode:
              input.report.procedureSolicitedHint ?? '?',
          },
          SEED.coverages,
        )
      : undefined;

    if (!policy || !coverage) {
      const reason = !policy
        ? `policy_not_found:${input.policyNumber}`
        : `coverage_not_found:${input.policyNumber}/${input.report.procedureSolicitedHint ?? '?'}`;

      // Caso se crea igual con status ESCALADO para que quede traza auditable.
      const failedCase: AuthorizationCase = {
        id: caseId,
        reportId: input.report.id,
        policyNumber: input.policyNumber,
        status: 'ESCALADO',
        decision: undefined,
        agentTrace: [],
        createdAt: new Date().toISOString(),
        decidedAt: new Date().toISOString(),
      };
      this.repository.create(failedCase);

      const errorEvent: AgentEvent = {
        kind: 'error',
        error: reason,
        trace: [],
      };
      return { caseId, events$: of(errorEvent) };
    }

    const initialCase: AuthorizationCase = {
      id: caseId,
      reportId: input.report.id,
      policyNumber: input.policyNumber,
      status: 'PENDIENTE',
      decision: undefined,
      agentTrace: [],
      createdAt: new Date().toISOString(),
    };
    this.repository.create(initialCase);

    const accumulatedTrace: TraceStep[] = [];

    const events$ = this.agent
      .run({
        report: input.report,
        policy,
        coverage,
        scenarioKey: input.scenarioKey,
      })
      .pipe(
        tap((event) => {
          if (event.kind === 'step') {
            // Sólo acumulamos los pasos terminales — los `running` son sólo señal de UI.
            if (event.step.state === 'running') {
              return;
            }
            accumulatedTrace.push(event.step);
            this.repository.update(caseId, {
              agentTrace: [...accumulatedTrace],
            });
            return;
          }

          if (event.kind === 'done') {
            this.repository.update(caseId, {
              status: mapOutcomeToStatus(event.decision.outcome),
              decision: event.decision,
              agentTrace: [...event.trace],
              decidedAt: new Date().toISOString(),
            });
            return;
          }

          // event.kind === 'error': política PRD — escalar, NUNCA auto-rechazar.
          this.repository.update(caseId, {
            status: 'ESCALADO',
            agentTrace: [...event.trace],
            decidedAt: new Date().toISOString(),
          });
        }),
        share(),
      );

    return { caseId, events$ };
  }
}

/**
 * Mapea el `Outcome` que emite el agente al `CaseStatus` del dashboard.
 *
 * - APPROVED_AUTO   → APROBADO_AUTO
 * - DOCS_REQUESTED  → DOCS_PEDIDOS
 * - ESCALATED       → ESCALADO
 * - DECIDED         → DECIDIDO   (improbable acá — sólo lo emite el auditor)
 * - PENDING         → PENDIENTE  (estado inicial — no debería llegar como `done`)
 */
function mapOutcomeToStatus(outcome: Outcome): CaseStatus {
  switch (outcome) {
    case 'APPROVED_AUTO':
      return 'APROBADO_AUTO';
    case 'DOCS_REQUESTED':
      return 'DOCS_PEDIDOS';
    case 'ESCALATED':
      return 'ESCALADO';
    case 'DECIDED':
      return 'DECIDIDO';
    case 'PENDING':
      return 'PENDIENTE';
  }
}

function generateCaseId(): string {
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `C-${Date.now()}-${suffix}`;
}
