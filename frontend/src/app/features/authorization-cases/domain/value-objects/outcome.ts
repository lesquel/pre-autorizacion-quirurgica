/**
 * Outcome — resultado emitido por el agente o el auditor.
 *
 * - `APPROVED_AUTO`   : agente aprueba automáticamente (cobertura + carencia + docs OK).
 * - `DOCS_REQUESTED`  : faltan documentos requeridos por la cobertura.
 * - `ESCALATED`       : agente escaló a auditor humano (NUNCA auto-rechaza).
 * - `DECIDED`         : caso ya cerrado/decidido (estado terminal de visualización).
 * - `PENDING`         : caso recién creado, todavía sin corrida del agente.
 */
export type Outcome =
  | 'APPROVED_AUTO'
  | 'DOCS_REQUESTED'
  | 'ESCALATED'
  | 'DECIDED'
  | 'PENDING';
