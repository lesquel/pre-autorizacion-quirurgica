/**
 * CaseStatus — estado del caso de autorización en el dashboard.
 *
 * Mapeo (referencia data.js / agent.js):
 * - APPROVED_AUTO  → APROBADO_AUTO
 * - DOCS_REQUESTED → DOCS_PEDIDOS  (alias del prototipo: PENDIENTE_DOCS)
 * - ESCALATED      → ESCALADO
 * - DECIDED        → DECIDIDO  (caso cerrado por auditor)
 * - PENDIENTE      → recién creado, sin correr el agente.
 */
export type CaseStatus =
  | 'PENDIENTE'
  | 'APROBADO_AUTO'
  | 'DOCS_PEDIDOS'
  | 'ESCALADO'
  | 'DECIDIDO';
