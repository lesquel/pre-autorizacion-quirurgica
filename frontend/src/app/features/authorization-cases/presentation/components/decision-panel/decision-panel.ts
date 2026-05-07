import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

import { Confidence } from '../../../../../shared/ui/confidence/confidence';
import { OutcomePill } from '../../../../../shared/ui/outcome-pill/outcome-pill';
import { Pill } from '../../../../../shared/ui/pill/pill';
import type { AgentDecision } from '../../../domain/value-objects/agent-decision';

/**
 * DecisionPanel — bloque auditable que muestra una `AgentDecision` completa.
 *
 * Render: outcome destacado, confianza con barra, rationale prominente,
 * lista de evidencia (informe / póliza), missingDocs y escalationReason
 * cuando aplican, y footer con `decidedBy` + `modelUsed`.
 *
 * Sigue el contrato auditable del PRD §3.1.3 / §4.2.1: rationale primero,
 * confianza visible, evidencia citada por campo, escalamiento explícito.
 */
@Component({
  selector: 'app-decision-panel',
  standalone: true,
  imports: [Confidence, OutcomePill, Pill],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article
      class="flex flex-col gap-5 p-5 bg-surface dark:bg-ink border border-line dark:border-ink-3"
    >
      <header class="flex items-center justify-between gap-3">
        <app-outcome-pill [outcome]="decision().outcome" />
        <span class="font-mono text-[10px] uppercase tracking-wider text-ink-4">
          decisión
        </span>
      </header>

      <div class="flex flex-col gap-2">
        <span
          class="font-mono text-[10px] uppercase tracking-wider text-ink-4"
        >
          Confianza
        </span>
        <app-confidence [value]="decision().confidence" />
      </div>

      <div class="flex flex-col gap-1.5">
        <span
          class="font-mono text-[10px] uppercase tracking-wider text-ink-4"
        >
          Razonamiento
        </span>
        <p
          class="text-base leading-relaxed text-ink dark:text-bg m-0"
        >
          {{ decision().rationale }}
        </p>
      </div>

      @if (decision().evidence.length > 0) {
        <div class="flex flex-col gap-2">
          <span
            class="font-mono text-[10px] uppercase tracking-wider text-ink-4"
          >
            Evidencia citada
          </span>
          <ul class="flex flex-col gap-3 m-0 p-0 list-none">
            @for (ev of decision().evidence; track $index) {
              <li class="flex items-start gap-3">
                <app-pill
                  [text]="ev.source === 'report' ? 'INFORME' : 'PÓLIZA'"
                  [tone]="ev.source === 'report' ? 'info' : 'default'"
                />
                <div class="flex-1 min-w-0 flex flex-col gap-1">
                  <span class="font-mono text-[11px] text-ink-3">
                    {{ ev.field }}
                  </span>
                  <blockquote
                    class="italic text-sm text-ink-3 dark:text-ink-5 border-l-2 border-line-2 pl-3 m-0"
                  >
                    "{{ ev.quote }}"
                  </blockquote>
                </div>
              </li>
            }
          </ul>
        </div>
      }

      @if (decision().missingDocs.length > 0) {
        <div class="flex flex-col gap-2">
          <span
            class="font-mono text-[10px] uppercase tracking-wider text-ink-4"
          >
            Documentos faltantes
          </span>
          <ul class="m-0 pl-5 flex flex-col gap-1 text-sm text-ink-3 dark:text-ink-5 list-disc">
            @for (doc of decision().missingDocs; track doc) {
              <li>{{ doc }}</li>
            }
          </ul>
        </div>
      }

      @if (decision().escalationReason) {
        <div class="flex flex-col gap-2">
          <span
            class="font-mono text-[10px] uppercase tracking-wider text-ink-4"
          >
            Motivo de escalamiento
          </span>
          <app-pill
            [text]="decision().escalationReason ?? ''"
            tone="err"
            [mono]="true"
          />
        </div>
      }

      <footer
        class="flex items-center justify-between gap-3 pt-3 border-t border-line dark:border-ink-3 font-mono text-[10px] uppercase tracking-wider text-ink-4"
      >
        <span>Decidido por: {{ decidedByLabel() }}</span>
        @if (decision().modelUsed) {
          <span>{{ decision().modelUsed }}</span>
        }
      </footer>
    </article>
  `,
})
export class DecisionPanel {
  readonly decision = input.required<AgentDecision>();

  protected readonly decidedByLabel = computed<string>(() =>
    this.decision().decidedBy === 'auditor' ? 'auditor' : 'agente',
  );
}
