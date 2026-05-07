/**
 * Patient — paciente del hospital. PRD §4.2.2 (DB Notion 1: Pacientes).
 *
 * Campo `dob` (date of birth) en formato ISO 'YYYY-MM-DD'.
 * `sex` admite 'X' además de 'M'/'F' por compatibilidad con identidad de género no-binaria
 * (extensión razonable; el prototipo sólo trae M/F).
 */
export interface Patient {
  readonly id: string;
  readonly dni: string;
  readonly name: string;
  readonly dob: string;
  readonly sex: 'M' | 'F' | 'X';
}
