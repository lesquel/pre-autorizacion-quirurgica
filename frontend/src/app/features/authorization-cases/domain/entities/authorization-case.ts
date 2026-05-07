import type {
  AgentDecision,
  CaseStatus,
  TraceStep,
} from '../value-objects';

/**
 * AuthorizationCase — agregado central del dominio.
 * PRD §4.2.2 (DB Notion 7: CasosAutorización).
 *
 * Campos:
 * - `reportId`     : FK a MedicalReport.
 * - `policyNumber` : FK a Policy (por número, no id interno).
 * - `status`       : CaseStatus (estado del workflow).
 * - `decision`     : AgentDecision (presente cuando se ejecutó el agente o resolvió un auditor).
 * - `agentTrace`   : pasos del agente (LangGraph, 7 nodos).
 * - `createdAt`    : ISO timestamp.
 * - `decidedAt`    : ISO timestamp cuando el caso queda terminal.
 */
export interface AuthorizationCase {
  readonly id: string;
  readonly reportId: string;
  readonly policyNumber: string;
  readonly status: CaseStatus;
  readonly decision?: AgentDecision;
  readonly agentTrace: readonly TraceStep[];
  readonly createdAt: string;
  readonly decidedAt?: string;
}
