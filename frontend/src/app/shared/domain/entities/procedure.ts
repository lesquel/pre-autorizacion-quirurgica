/**
 * Procedure — procedimiento quirúrgico (catálogo CIE-10).
 * PRD §4.2.2 (DB Notion 3: Procedimientos).
 *
 * - `code`                : código CIE-10 (ej: 'K80.20').
 * - `category`            : especialidad (Cirugía general, Traumatología, ...).
 * - `waitingDaysTypical`  : carencia típica del catálogo. La carencia REAL aplicable
 *                           vive en `Coverage.waitingDays` por póliza × procedimiento.
 */
export interface Procedure {
  readonly code: string;
  readonly name: string;
  readonly category?: string;
  readonly waitingDaysTypical?: number;
}
