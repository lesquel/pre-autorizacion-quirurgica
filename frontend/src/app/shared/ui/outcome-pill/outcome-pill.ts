import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Pill, type PillTone } from '../pill/pill';

export type Outcome =
  | 'APPROVED_AUTO'
  | 'DOCS_REQUESTED'
  | 'ESCALATED'
  | 'DECIDED'
  | 'PENDING';

interface OutcomeMeta {
  tone: PillTone;
  label: string;
}

const OUTCOME_MAP: Record<Outcome, OutcomeMeta> = {
  APPROVED_AUTO: { tone: 'ok', label: 'APROBADO' },
  DOCS_REQUESTED: { tone: 'warn', label: 'DOCS PEDIDOS' },
  ESCALATED: { tone: 'err', label: 'ESCALADO' },
  DECIDED: { tone: 'info', label: 'DECIDIDO' },
  PENDING: { tone: 'default', label: 'PENDIENTE' },
};

/**
 * OutcomePill — versión semántica del Pill atado al dominio del agente.
 *
 * Mapea outcome (+ status opcional) a tono visual y etiqueta legible en español.
 * Reutiliza Pill para la presentación.
 */
@Component({
  selector: 'app-outcome-pill',
  standalone: true,
  imports: [Pill],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-pill [text]="label()" [tone]="tone()" />`,
})
export class OutcomePill {
  readonly outcome = input.required<Outcome>();
  readonly status = input<string | undefined>(undefined);

  protected readonly meta = computed<OutcomeMeta>(() => OUTCOME_MAP[this.outcome()]);
  protected readonly tone = computed<PillTone>(() => this.meta().tone);
  protected readonly label = computed<string>(() => this.status() ?? this.meta().label);
}
