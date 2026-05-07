import type { EscalationReason } from './escalation-reason';
import type { Evidence } from './evidence';
import type { Outcome } from './outcome';

/**
 * AgentDecision — value object emitido por el agente o el auditor.
 *
 * Contrato auditable definido en PRD §3.1.3 / §4.2.1 y materializado por
 * `decisionFor` en `preatuomatizacion/agent.js`.
 *
 * Campos:
 * - `outcome`           : resultado final.
 * - `rationale`         : explicación natural (español) — auditable.
 * - `confidence`        : ∈ [0.0, 1.0]. Gate determinístico: < 0.80 fuerza ESCALATED.
 * - `evidence`          : citas que respaldan el rationale (origen + campo + quote).
 * - `missingDocs`       : lista de documentos faltantes (relevante en DOCS_REQUESTED).
 * - `escalationReason`  : motivo del escalamiento (null si no aplica).
 * - `decidedBy`         : 'agent' (automático) o 'auditor' (humano resolvió escalado).
 * - `modelUsed`         : modelo LLM que produjo la decisión (ej: 'deepseek-chat').
 */
export interface AgentDecision {
  readonly outcome: Outcome;
  readonly rationale: string;
  readonly confidence: number;
  readonly evidence: readonly Evidence[];
  readonly missingDocs: readonly string[];
  readonly escalationReason: EscalationReason | null;
  readonly decidedBy: 'agent' | 'auditor';
  readonly modelUsed?: string;
}
