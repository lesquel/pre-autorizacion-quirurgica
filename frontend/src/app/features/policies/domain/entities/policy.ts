/**
 * Policy — póliza de seguro de un paciente.
 * PRD §4.2.2 (DB Notion 4: Pólizas).
 *
 * NOTA: el prototipo data.js usa `status: 'ACTIVA'` (string en español).
 * Acá normalizamos a literales canónicos en inglés ('ACTIVE' | 'INACTIVE' | 'SUSPENDED')
 * y el seed se encarga del mapeo. Esto facilita lógica determinística posterior.
 *
 * `insurerId` referencia el `Insurer.id`. El seed lo deriva del campo `insurer` (string)
 * del prototipo (única aseguradora: "Aseguradora Andina S.A." → INS-ANDINA).
 */
export interface Policy {
  readonly number: string;
  readonly patientId: string;
  readonly plan: string;
  readonly insurerId: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
}
