/**
 * Evidence — cita auditable que respalda una decisión del agente.
 * Contrato del PRD §4.2.1 + agent.js (`decisionFor`).
 */
export interface Evidence {
  readonly source: 'report' | 'policy';
  readonly field: string;
  readonly quote: string;
}
