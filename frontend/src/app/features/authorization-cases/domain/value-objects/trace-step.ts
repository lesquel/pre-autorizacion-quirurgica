/**
 * TraceStep — paso individual de la traza del agente (LangGraph 7 nodos).
 *
 * Nodos esperados (ver `AGENT_NODES` en agent.js):
 *   extract_report, match_procedure, load_policy_coverage, check_waiting_period,
 *   check_required_docs, make_decision, persist_case.
 *
 * Estados:
 * - `running` : nodo en ejecución.
 * - `done`    : completado exitosamente.
 * - `error`   : falló (incluye casos `warn`/`pending` del prototipo, normalizados acá
 *               a `done` o `error` según severidad — el prototipo distingue 'warn'/'pending'
 *               como sub-estados de UI; el dominio sólo conserva los terminales).
 */
export interface TraceStep {
  readonly node: string;
  readonly timestamp: string;
  readonly state: 'running' | 'done' | 'error';
  readonly durationMs?: number;
  readonly modelUsed?: string;
  readonly tokensIn?: number;
  readonly tokensOut?: number;
  readonly detail?: string;
  readonly error?: string;
}
