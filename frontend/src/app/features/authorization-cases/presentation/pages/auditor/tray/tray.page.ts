import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';

import { PageHeader } from '../../../../../../core/components';
import { AuthorizationCasesFacade } from '../../../../application/facades/authorization-cases.facade';
import type { EscalationReason } from '../../../../domain/value-objects';
import { CaseTable } from '../../../components';

type ReasonFilter = EscalationReason | 'all';

interface FilterChip {
  readonly key: ReasonFilter;
  readonly label: string;
}

const FILTERS: readonly FilterChip[] = [
  { key: 'all', label: 'Todos' },
  { key: 'WAITING_PERIOD_NOT_MET', label: 'Carencia' },
  { key: 'LOW_CONFIDENCE_PROCEDURE_MATCH', label: 'Baja confianza' },
  { key: 'PDF_EXTRACTION_FAILURE', label: 'Falla PDF' },
];

/**
 * AuditorTrayPage — bandeja de casos escalados pendientes de revisión.
 *
 * Filtra por razón de escalamiento mediante chips. El click en una fila
 * navega al detalle del caso. El estado vive en signals locales — la única
 * fuente de verdad de los casos es la `AuthorizationCasesFacade`.
 */
@Component({
  selector: 'app-auditor-tray-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, CaseTable],
  template: `
    <div class="flex flex-col gap-5">
      <app-page-header
        title="Bandeja del auditor"
        subtitle="Casos escalados pendientes de revisión clínica"
      />

      <section class="px-0 lg:px-7 flex flex-wrap items-center gap-2">
        @for (chip of filters; track chip.key) {
          <button
            type="button"
            (click)="setFilter(chip.key)"
            [class]="chipClasses(chip.key)"
          >
            {{ chip.label }}
            @if (chip.key !== 'all') {
              <span class="ml-1 font-mono text-[10px] opacity-70">
                {{ countFor(chip.key) }}
              </span>
            } @else {
              <span class="ml-1 font-mono text-[10px] opacity-70">
                {{ escalatedCases().length }}
              </span>
            }
          </button>
        }
      </section>

      <section class="px-0 lg:px-7">
        <app-case-table
          [cases]="filteredCases()"
          mode="auditor"
          (caseClicked)="openCase($event)"
        />
      </section>
    </div>
  `,
})
export class AuditorTrayPage {
  private readonly facade = inject(AuthorizationCasesFacade);
  private readonly router = inject(Router);

  protected readonly filters = FILTERS;
  protected readonly filterReason = signal<ReasonFilter>('all');

  protected readonly escalatedCases = computed(() =>
    this.facade.cases().filter((c) => c.status === 'ESCALADO'),
  );

  protected readonly filteredCases = computed(() => {
    const reason = this.filterReason();
    const all = this.escalatedCases();
    if (reason === 'all') {
      return all;
    }
    return all.filter((c) => c.decision?.escalationReason === reason);
  });

  protected setFilter(reason: ReasonFilter): void {
    this.filterReason.set(reason);
  }

  protected countFor(reason: EscalationReason): number {
    return this.escalatedCases().filter(
      (c) => c.decision?.escalationReason === reason,
    ).length;
  }

  protected chipClasses(key: ReasonFilter): string {
    const base =
      'inline-flex items-center px-3 py-1.5 text-xs font-mono uppercase tracking-wider border transition-colors';
    return this.filterReason() === key
      ? `${base} bg-ink text-bg border-ink dark:bg-bg dark:text-ink dark:border-bg`
      : `${base} bg-surface text-ink-3 border-line hover:border-ink-4 dark:bg-ink dark:text-ink-5 dark:border-ink-3`;
  }

  protected openCase(caseId: string): void {
    void this.router.navigate(['/auditor/case', caseId]);
  }
}
