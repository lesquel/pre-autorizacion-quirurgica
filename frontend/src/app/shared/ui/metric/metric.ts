import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

export type MetricTone = 'ok' | 'warn' | 'err' | 'default';

/**
 * Metric — tarjeta compacta de KPI (label arriba, value abajo).
 *
 * Replica `.metric` del prototipo: borde sutil, surface, tabular-nums,
 * label en mono uppercase.
 */
@Component({
  selector: 'app-metric',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-1.5 p-4 bg-surface border border-line">
      <span
        class="text-[10px] font-mono uppercase tracking-wider text-ink-4"
      >
        {{ label() }}
      </span>
      <span
        class="text-2xl font-semibold tabular-nums leading-none"
        [class]="valueClass()"
      >
        {{ value() }}
      </span>
    </div>
  `,
})
export class Metric {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly tone = input<MetricTone>('default');

  protected readonly valueClass = computed<string>(() => {
    const map: Record<MetricTone, string> = {
      ok: 'text-ok',
      warn: 'text-warn',
      err: 'text-err',
      default: 'text-ink',
    };
    return map[this.tone()];
  });
}
