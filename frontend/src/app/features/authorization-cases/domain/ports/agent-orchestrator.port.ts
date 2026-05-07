import type { Observable } from 'rxjs';

import type { Coverage, Policy } from '../../../policies/domain/entities';
import type { MedicalReport } from '../entities/medical-report';
import type { AgentDecision } from '../value-objects/agent-decision';
import type { TraceStep } from '../value-objects/trace-step';

/**
 * AgentRunRequest — input para correr el agente sobre un caso concreto.
 *
 * - `report`       : informe médico que se va a evaluar.
 * - `policy`       : póliza del paciente (cobertura/vigencia).
 * - `coverage`     : fila póliza × procedimiento (carencia, copago, docs).
 * - `scenarioKey`  : override opcional para forzar un escenario en demos
 *                    (p. ej. `'APPROVED_AUTO'`, `'ESCALATED_PDF_FAIL'`).
 *                    Cuando viene, el adapter NO infiere el escenario y usa este
 *                    valor tal cual. Útil para reproducir una decisión exacta.
 */
export interface AgentRunRequest {
  readonly report: MedicalReport;
  readonly policy: Policy;
  readonly coverage: Coverage;
  readonly scenarioKey?: string;
}

/**
 * AgentEvent — evento emitido por la stream del agente.
 *
 * Discriminado por `kind`:
 * - `step`  : un paso de la traza (estado `running` cuando arranca, `done`/`error` al terminar).
 * - `done`  : terminó la corrida con la decisión final y la traza completa.
 * - `error` : falló de forma irrecuperable (la traza acumulada se entrega igual).
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

/**
 * AgentOrchestrator — port del agente de pre-autorización.
 *
 * Se modela como **clase abstracta** (no interface) para que Angular DI pueda
 * usarla directamente como token: `provide: AgentOrchestrator, useClass: MockAgentAdapter`.
 *
 * Contrato:
 * - `run` devuelve un `Observable<AgentEvent>` que emite los pasos de forma
 *   secuencial con timing realista, terminando con un evento `done` o `error`.
 * - El observable debe completarse después del evento terminal.
 */
export abstract class AgentOrchestrator {
  /**
   * Corre el agente sobre el caso descrito por `request` y emite eventos
   * (`step`/`done`/`error`) a medida que avanza la traza.
   */
  abstract run(request: AgentRunRequest): Observable<AgentEvent>;
}
