import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';

import { PageHeader } from '../../../../../../core/components/page-header/page-header';
import { Pill, type PillTone } from '../../../../../../shared/ui/pill/pill';
import { CaseChip } from '../../../../../../shared/ui/case-chip/case-chip';
import { AuthorizationCasesFacade } from '../../../../application/facades/authorization-cases.facade';
import { AgentTraceViewer } from '../../../components/agent-trace-viewer/agent-trace-viewer';
import { DecisionPanel } from '../../../components/decision-panel/decision-panel';

const STATUS_LABEL: Record<'running' | 'done' | 'error', string> = {
  running: 'EN CURSO',
  done: 'COMPLETADO',
  error: 'ERROR',
};

const STATUS_TONE: Record<'running' | 'done' | 'error', PillTone> = {
  running: 'info',
  done: 'ok',
  error: 'err',
};

/**
 * HospitalLiveRunPage — visor en vivo de la corrida del agente.
 *
 * Lee `facade.currentRun()`. Si no hay run, muestra empty state con CTA
 * a /hospital/submit. Layout 2 columnas (md+): traza a la izquierda,
 * decisión a la derecha (placeholder mientras el agente sigue corriendo).
 *
 * No suscribe Observables — todo viene por signals desde la facade.
 */
@Component({
  selector: 'app-hospital-live-run-page',
  standalone: true,
  imports: [PageHeader, Pill, CaseChip, AgentTraceViewer, DecisionPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let run = facade.currentRun();

    @if (!run) {
      <app-page-header
        title="Pre-autorización en curso"
        subtitle="No hay ninguna corrida activa."
        [breadcrumbs]="['Hospital', 'En curso']"
      />
      <section
        class="px-7 py-12 flex flex-col items-center gap-4 text-center"
      >
        <p class="text-ink-3 dark:text-ink-5 m-0">
          No hay ninguna pre-autorización en curso ahora mismo.
        </p>
        <button
          type="button"
          class="px-4 py-2 bg-ink dark:bg-bg text-bg dark:text-ink border border-ink dark:border-bg font-mono text-xs uppercase tracking-wider hover:opacity-90 transition-opacity"
          (click)="goSubmit()"
        >
          Crear nueva solicitud →
        </button>
      </section>
    } @else {
      <app-page-header
        title="Pre-autorización en curso"
        [subtitle]="'Caso ' + run.caseId"
        [breadcrumbs]="['Hospital', 'En curso']"
      >
        <button
          type="button"
          class="px-3 py-1.5 bg-bg-2 dark:bg-ink-2 border border-line dark:border-ink-3 text-ink dark:text-bg font-mono text-xs uppercase tracking-wider hover:bg-bg-3 transition-colors"
          (click)="goSubmit()"
        >
          ← Volver
        </button>
      </app-page-header>

      <section class="px-7 py-6 flex flex-col gap-5">
        <div class="flex items-center gap-3">
          <span
            class="font-mono text-[10px] uppercase tracking-wider text-ink-4"
          >
            Estado
          </span>
          <app-pill [text]="statusLabel()" [tone]="statusTone()" [mono]="true" />
          <app-case-chip [id]="run.caseId" />
          @if (run.error) {
            <span class="font-mono text-[11px] text-err">{{ run.error }}</span>
          }
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div class="bg-surface dark:bg-ink border border-line dark:border-ink-3">
            <div
              class="px-4 py-2.5 border-b border-line dark:border-ink-3 font-mono text-[10px] uppercase tracking-wider text-ink-4"
            >
              Traza del agente · {{ run.trace.length }} {{ run.trace.length === 1 ? 'paso' : 'pasos' }}
            </div>
            <app-agent-trace-viewer [trace]="run.trace" />
          </div>

          <div>
            @if (run.decision) {
              <app-decision-panel [decision]="run.decision" />
            } @else {
              <div
                class="flex items-center justify-center min-h-[300px] p-6 bg-surface dark:bg-ink border border-dashed border-line-2 dark:border-ink-3 text-center"
              >
                <div class="flex flex-col items-center gap-3">
                  <svg
                    class="w-6 h-6 text-info animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-opacity="0.25"
                    ></circle>
                    <path
                      d="M21 12a9 9 0 0 1-9 9"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                    ></path>
                  </svg>
                  <p class="text-sm text-ink-3 dark:text-ink-5 m-0">
                    Esperando decisión…
                  </p>
                </div>
              </div>
            }
          </div>
        </div>
      </section>
    }
  `,
})
export class HospitalLiveRunPage {
  protected readonly facade = inject(AuthorizationCasesFacade);
  private readonly router = inject(Router);

  protected readonly statusLabel = computed<string>(() => {
    const run = this.facade.currentRun();
    return run ? STATUS_LABEL[run.status] : '';
  });

  protected readonly statusTone = computed<PillTone>(() => {
    const run = this.facade.currentRun();
    return run ? STATUS_TONE[run.status] : 'default';
  });

  protected goSubmit(): void {
    void this.router.navigate(['/hospital/submit']);
  }
}
