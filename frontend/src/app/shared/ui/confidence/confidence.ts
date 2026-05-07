import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

import { confidenceTone, type ConfidenceTone } from '../../helpers';

/**
 * Confidence — barra horizontal compacta para visualizar score de confianza (0..1).
 *
 * Tonos resueltos por el helper `confidenceTone` (fuente única de verdad,
 * alineada al prototipo y al PRD §3.1.3). Render: track bg-bg-3, fill
 * coloreado por tono, % en mono a la derecha.
 */
@Component({
  selector: 'app-confidence',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center gap-2 min-w-[100px]">
      <div class="relative h-2.5 flex-1 bg-bg-3 overflow-hidden">
        <div
          class="h-full transition-[width] duration-300"
          [class]="fillClass()"
          [style.width.%]="percent()"
        ></div>
      </div>
      <span class="font-mono text-[11px] text-ink-3 tabular-nums">
        {{ percent() }}%
      </span>
    </div>
  `,
})
export class Confidence {
  readonly value = input.required<number>();

  protected readonly tone = computed<ConfidenceTone>(() => confidenceTone(this.value()));

  protected readonly fillClass = computed<string>(() => {
    const map: Record<ConfidenceTone, string> = {
      ok: 'bg-ok',
      warn: 'bg-warn',
      err: 'bg-err',
    };
    return map[this.tone()];
  });

  protected readonly percent = computed<number>(() =>
    Math.round(this.value() * 100),
  );
}
