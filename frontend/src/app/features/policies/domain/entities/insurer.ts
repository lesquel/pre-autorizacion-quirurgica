/**
 * Insurer — aseguradora. PRD §4.2.2 (DB Notion 2: Aseguradoras).
 *
 * NOTA: el prototipo data.js no expone `Insurer` como entidad separada —
 * cada Policy carga `insurer` como string literal. Se la modela acá igual
 * para alinear con la especificación oficial (PRD §4.2.1).
 */
export interface Insurer {
  readonly id: string;
  readonly name: string;
  readonly email?: string;
}
