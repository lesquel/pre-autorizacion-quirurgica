/**
 * Coverage — fila póliza × procedimiento.
 * PRD §4.2.2 (DB Notion 5: Coberturas).
 *
 * - `waitingDays`   : días de carencia desde inicio de póliza.
 * - `copay`         : USD (puede ser 0).
 * - `requiredDocs`  : lista de documentos requeridos por la póliza para este procedimiento.
 *
 * El nombre del campo en data.js es `required` — acá se usa `requiredDocs` (más explícito).
 */
export interface Coverage {
  readonly policyNumber: string;
  readonly procedureCode: string;
  readonly covered: boolean;
  readonly waitingDays: number;
  readonly copay: number;
  readonly requiredDocs: readonly string[];
}
