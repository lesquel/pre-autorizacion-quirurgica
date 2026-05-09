import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';

import { PageHeader } from '../../../../../../core/components';
import { formatDuration, formatPercent } from '../../../../../../shared/helpers';
import { Metric } from '../../../../../../shared/ui';
import { PoliciesFacade } from '../../../../application/facades/policies.facade';

/**
 * Outcome distribution row — modelo intermedio para renderizar las 4 barras
 * horizontales del bloque "distribución de outcomes".
 *
 * Calculamos `widthPct` acá (no en el template) para que el binding
 * `[style.width.%]` reciba un número listo y para que Angular OnPush sólo
 * recompute cuando cambien los counters subyacentes (vía signal `metrics`).
 */
interface OutcomeBar {
  readonly key: 'auto' | 'docs' | 'escalated' | 'decided';
  readonly label: string;
  readonly count: number;
  readonly widthPct: number;
  readonly barClass: string;
  readonly labelClass: string;
}

@Component({
  selector: 'app-insurer-dashboard-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, Metric],
  template: `
    <app-page-header
      title="Panel de la aseguradora"
      subtitle="Vista global de la operación"
    />

    <section class="px-0 py-4 lg:px-7 lg:py-6 flex flex-col gap-6">
      <!-- KPI cards principales (5 columnas) -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <app-metric label="Total casos" [value]="m().total" />
        <app-metric
          label="Auto-aprobados"
          [value]="autoApprovedDisplay()"
          [tone]="autoTone()"
        />
        <app-metric
          label="Docs pedidos"
          [value]="m().docsRequested"
          tone="warn"
        />
        <app-metric
          label="Escalados"
          [value]="m().escalated"
          [tone]="escalatedTone()"
        />
        <app-metric label="Decididos" [value]="m().decided" tone="default" />
      </div>

      <!-- Segunda fila: confianza + duración -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
        <app-metric
          label="Confianza promedio"
          [value]="avgConfidenceDisplay()"
        />
        <app-metric
          label="Duración promedio"
          [value]="avgDurationDisplay()"
        />
      </div>

      <!-- Distribución visual de outcomes -->
      <div class="bg-surface border border-line p-5">
        <header class="flex items-baseline justify-between mb-4">
          <h2
            class="font-serif text-lg font-semibold tracking-tight text-ink m-0"
          >
            Distribución de outcomes
          </h2>
          <span
            class="font-mono text-[10px] uppercase tracking-wider text-ink-4"
          >
            sobre {{ m().total }} casos
          </span>
        </header>

        @if (m().total === 0) {
          <p class="text-sm text-ink-3 m-0">
            Sin casos todavía — la distribución aparece cuando llegue el primer
            envío.
          </p>
        } @else {
          <div class="flex flex-col gap-4">
            @for (bar of outcomeBars(); track bar.key) {
              <div class="flex flex-col gap-1.5">
                <div class="flex items-baseline justify-between">
                  <span
                    class="font-mono text-[11px] uppercase tracking-wider"
                    [class]="bar.labelClass"
                  >
                    {{ bar.label }}
                  </span>
                  <span class="text-xs tabular-nums text-ink-3">
                    {{ bar.count }} ·
                    <span class="font-mono">{{ bar.widthPct.toFixed(0) }}%</span>
                  </span>
                </div>
                <div class="h-2 bg-bg-3 border border-line overflow-hidden">
                  <div
                    class="h-full transition-[width] duration-300 ease-out"
                    [class]="bar.barClass"
                    [style.width.%]="bar.widthPct"
                  ></div>
                </div>
              </div>
            }
          </div>
        }
      </div>
    </section>
  `,
})
export class InsurerDashboardPage {
  private readonly facade = inject(PoliciesFacade);

  protected readonly m = this.facade.metrics;

  /**
   * Display de "Auto-aprobados N (XX%)" — calculado en el componente porque la
   * `Metric` recibe un único `value`. Mantiene la grilla alineada y usamos el
   * porcentaje del use case (no recomputamos).
   */
  protected readonly autoApprovedDisplay = computed<string>(() => {
    const metrics = this.m();
    if (metrics.total === 0) {
      return '0';
    }
    return `${metrics.autoApproved} (${metrics.autoApprovedPct.toFixed(0)}%)`;
  });

  protected readonly autoTone = computed<'ok' | 'default'>(() =>
    this.m().autoApprovedPct > 60 ? 'ok' : 'default',
  );

  /**
   * Tone del card "Escalados": rojo si > 30% del total. Threshold tomado del
   * prompt; refleja la convicción operativa del PRD (auto-resolución target
   * ≥60%, escalamiento <30% sería el complemento sano).
   */
  protected readonly escalatedTone = computed<'err' | 'default'>(() => {
    const metrics = this.m();
    if (metrics.total === 0) return 'default';
    const pct = (metrics.escalated / metrics.total) * 100;
    return pct > 30 ? 'err' : 'default';
  });

  protected readonly avgConfidenceDisplay = computed<string>(() =>
    formatPercent(this.m().avgConfidence, 1),
  );

  protected readonly avgDurationDisplay = computed<string>(() =>
    formatDuration(this.m().avgDurationMs),
  );

  /**
   * Distribución de outcomes — 4 barras horizontales con width % sobre `total`.
   * Colores acoplados a la semántica del design system:
   *   auto       → bg-ok    (aprobado)
   *   docs       → bg-warn  (atención requerida)
   *   escalated  → bg-err   (problema / acción humana)
   *   decided    → bg-info  (cerrado por auditor)
   *
   * `widthPct` se clampa a [0, 100] para evitar floats con drift numérico.
   */
  protected readonly outcomeBars = computed<readonly OutcomeBar[]>(() => {
    const metrics = this.m();
    const total = metrics.total;
    const pct = (n: number) =>
      total === 0 ? 0 : Math.max(0, Math.min(100, (n / total) * 100));

    return [
      {
        key: 'auto',
        label: 'Aprobado auto',
        count: metrics.autoApproved,
        widthPct: pct(metrics.autoApproved),
        barClass: 'bg-ok',
        labelClass: 'text-ok',
      },
      {
        key: 'docs',
        label: 'Docs pedidos',
        count: metrics.docsRequested,
        widthPct: pct(metrics.docsRequested),
        barClass: 'bg-warn',
        labelClass: 'text-warn',
      },
      {
        key: 'escalated',
        label: 'Escalado',
        count: metrics.escalated,
        widthPct: pct(metrics.escalated),
        barClass: 'bg-err',
        labelClass: 'text-err',
      },
      {
        key: 'decided',
        label: 'Decidido',
        count: metrics.decided,
        widthPct: pct(metrics.decided),
        barClass: 'bg-info',
        labelClass: 'text-info',
      },
    ];
  });
}
