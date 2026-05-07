import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';

import { OutcomePill } from '../../../../../shared/ui/outcome-pill/outcome-pill';
import type { Outcome } from '../../../domain/value-objects/outcome';
import type { DemoScenarioKey } from '../../../../../shared/fixtures/seed';

/**
 * DemoScenario — vista combinada para el picker.
 *
 * Combina datos de SEED.demoCases (label, datos del caso) con metadata de
 * presentación (descripción, expectedOutcome) para poder mostrar al hospital
 * qué resultado espera el agente en cada escenario.
 */
export interface DemoScenario {
  readonly key: DemoScenarioKey;
  readonly label: string;
  readonly description: string;
  readonly expectedOutcome: Outcome;
  readonly patientId: string;
  readonly policyNumber: string;
  readonly procedureCode: string;
  readonly format: 'TEXT' | 'PDF';
  readonly report: string;
  readonly attachedDocs: readonly string[];
}

/**
 * ScenarioPicker — grid horizontal de cards clickeables con los 5 escenarios
 * de demo. Cada card muestra label + descripción corta + OutcomePill esperada.
 *
 * Click en card → emite `select` con el `DemoScenario` completo.
 */
@Component({
  selector: 'app-scenario-picker',
  standalone: true,
  imports: [OutcomePill],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3"
    >
      @for (s of scenarios(); track s.key) {
        <button
          type="button"
          class="flex flex-col gap-2 p-4 text-left bg-surface dark:bg-ink border border-line dark:border-ink-3 hover:bg-bg-2 dark:hover:bg-ink-2 transition-colors"
          (click)="select.emit(s)"
        >
          <div class="flex items-start justify-between gap-2">
            <span class="text-sm font-medium text-ink dark:text-bg leading-snug">
              {{ s.label }}
            </span>
            <app-outcome-pill [outcome]="s.expectedOutcome" />
          </div>
          <p class="text-xs text-ink-3 dark:text-ink-5 leading-relaxed m-0">
            {{ s.description }}
          </p>
          <div
            class="font-mono text-[10px] uppercase tracking-wider text-ink-4 mt-auto pt-2 border-t border-line dark:border-ink-3"
          >
            {{ s.key }}
          </div>
        </button>
      }
    </div>
  `,
})
export class ScenarioPicker {
  readonly scenarios = input.required<readonly DemoScenario[]>();
  readonly select = output<DemoScenario>();
}
