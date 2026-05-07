import type { Observable } from 'rxjs';

import type { MedicalReport } from '../entities/medical-report';
import type { AgentDecision } from '../value-objects/agent-decision';
import type { TraceStep } from '../value-objects/trace-step';

/**
 * AgentRunRequest — input for one agent run (TEXT only in v1).
 *
 * The previous `policy` and `coverage` fields are gone — the backend resolves
 * them from `policyNumber` + the report's procedure hint. PDF support
 * arrives in Task 15 via a sibling discriminated input.
 */
export interface AgentRunRequest {
  readonly report: MedicalReport;
  readonly policyNumber: string;
  readonly scenarioKey?: string;
}

/**
 * AgentEvent — discriminated union of `step` / `done` / `error`.
 */
export type AgentEvent =
  | { readonly kind: 'step'; readonly step: TraceStep }
  | {
      readonly kind: 'done';
      readonly decision: AgentDecision;
      readonly trace: readonly TraceStep[];
    }
  | {
      readonly kind: 'error';
      readonly error: string;
      readonly trace: readonly TraceStep[];
    };

export abstract class AgentOrchestrator {
  /**
   * Submit a case and stream its trace + decision back.
   *
   * Returns the `caseId` synchronously (preallocated client-side or
   * resolved from the response — implementation defined) and an Observable
   * of `AgentEvent` that completes after the terminal `done`/`error`.
   */
  abstract run(request: AgentRunRequest): Observable<AgentEvent>;
}
