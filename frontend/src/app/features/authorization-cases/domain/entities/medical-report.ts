/**
 * MedicalReport — informe médico prequirúrgico que el hospital adjunta al caso.
 * PRD §4.2.2 (DB Notion 6: InformesMédicos).
 *
 * Campos:
 * - `format`                    : 'text' o 'pdf'. Si 'pdf', el agente usa VisionExtractor.
 * - `content`                   : texto del informe (o stub para PDF — ej. "[archivo.pdf · ...]").
 * - `procedureSolicitedHint`    : código CIE-10 sugerido por el hospital ('?' si ambiguo).
 * - `diagnosis`                 : diagnóstico extraído (opcional, lo completa el agente).
 * - `attendingDoctor`           : médico tratante.
 * - `submittedAt`               : ISO timestamp de envío al sistema.
 */
export interface MedicalReport {
  readonly id: string;
  readonly patientId: string;
  readonly format: 'text' | 'pdf';
  readonly content: string;
  readonly procedureSolicitedHint?: string;
  readonly diagnosis?: string;
  readonly attendingDoctor?: string;
  readonly submittedAt: string;
}
