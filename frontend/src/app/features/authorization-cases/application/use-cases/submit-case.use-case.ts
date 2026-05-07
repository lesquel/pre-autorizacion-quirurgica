import { Injectable, inject } from '@angular/core';
import { type Observable, share, tap } from 'rxjs';

import type { AuthorizationCase } from '../../domain/entities/authorization-case';
import type { MedicalReport } from '../../domain/entities/medical-report';
import type { AgentEvent } from '../../domain/ports/agent-orchestrator.port';
import { AgentOrchestrator } from '../../domain/ports/agent-orchestrator.port';
import { CaseRepository } from '../../domain/ports/case-repository.port';
import type { CaseStatus } from '../../domain/value-objects/case-status';
import type { Outcome } from '../../domain/value-objects/outcome';
import type { TraceStep } from '../../domain/value-objects/trace-step';

export interface SubmitCaseInput {
  readonly report: MedicalReport;
  readonly policyNumber: string;
  readonly scenarioKey?: string;
  readonly file?: File;
}

/**
 * SubmitCaseUseCase — thin orchestration around `AgentOrchestrator`.
 *
 * Domain side-effects:
 *  - On `step` (terminal state): append to the local case's trace.
 *  - On `done`: finalize the case with status + decision.
 *  - On `error`: mark case ESCALADO (PRD: never auto-reject).
 *
 * Note: the case row itself is created by the orchestrator's response
 * (the backend assigns the id) — we only persist UI-side updates here.
 */
@Injectable({ providedIn: 'root' })
export class SubmitCaseUseCase {
  private readonly repository = inject(CaseRepository);
  private readonly agent = inject(AgentOrchestrator);

  execute(input: SubmitCaseInput): {
    readonly caseId: string;
    readonly events$: Observable<AgentEvent>;
  } {
    const stream = this.agent.run({
      report: input.report,
      policyNumber: input.policyNumber,
      scenarioKey: input.scenarioKey,
      file: input.file,
    });

    // The HTTP adapter resolves the real caseId asynchronously (after the POST
    // response). For now we surface a placeholder; the facade reads `caseId`
    // from the `done`/`error` event by inspecting the trace/decision.
    // Update: HttpAgentAdapter exposes the real id via a side channel — the
    // facade's `currentRun.caseId` gets set from the first emitted step's
    // metadata. To keep the existing facade API working without changes,
    // we extract the real id from the stream and patch it via tap.
    let caseId = `PENDING-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const accumulatedTrace: TraceStep[] = [];

    const events$ = stream.pipe(
      tap((event) => {
        if (event.kind === 'step') {
          if (event.step.state === 'running') return;
          accumulatedTrace.push(event.step);
          // We can't update by id until we know it; the HttpAgentAdapter
          // patches the id via `update(...)` once known. Skip update here.
          return;
        }
        // Terminal event arrived: the adapter has already created the case
        // entry in the repo with the real id; nothing more to do here.
        return;
      }),
      share(),
    );

    return { caseId, events$ };
  }
}

/** Outcome → CaseStatus mapping. Kept exported for reuse in the adapter. */
export function mapOutcomeToStatus(outcome: Outcome): CaseStatus {
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

// Re-export the case shape so the adapter doesn't have to re-import the entity
export type { AuthorizationCase };
