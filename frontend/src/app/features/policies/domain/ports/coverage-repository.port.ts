import type { Coverage } from '../entities';

/**
 * CoverageRepository — port de acceso a las coberturas (read-only en MVP).
 *
 * Cada `Coverage` es la fila póliza × procedimiento (PRD §4.2.2 DB Notion 5).
 * `listForPolicy` es el query más usado: la vista de Aseguradora muestra las
 * coberturas filtradas por póliza seleccionada.
 */
export abstract class CoverageRepository {
  /** Lista todas las coberturas conocidas. */
  abstract list(): readonly Coverage[];

  /** Lista las coberturas asociadas a la póliza `policyNumber`. */
  abstract listForPolicy(policyNumber: string): readonly Coverage[];
}
