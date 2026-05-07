import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

export type PillTone = 'ok' | 'warn' | 'err' | 'info' | 'default';

/**
 * Pill — badge tipográfica con tono semántico.
 *
 * Replica la estética del prototipo (`.pill[data-tone="..."]` en styles.css):
 * mono, uppercase, tracking ancho, padding chico, borde sutil.
 * El tono se expresa con colores del design system (tokens Tailwind v4).
 */
@Component({
  selector: 'app-pill',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span [class]="classes()">
      <ng-content />{{ text() }}
    </span>
  `,
})
export class Pill {
  readonly text = input.required<string>();
  readonly tone = input<PillTone>('default');
  readonly mono = input<boolean>(false);

  protected readonly classes = computed<string>(() => {
    const base =
      'inline-flex items-center gap-1.5 px-2 py-0.5 border text-[10px] uppercase tracking-wider whitespace-nowrap';
    const toneClasses: Record<PillTone, string> = {
      ok: 'bg-ok-bg text-ok border-ok/30',
      warn: 'bg-warn-bg text-warn border-warn/30',
      err: 'bg-err-bg text-err border-err/30',
      info: 'bg-info-bg text-info border-info/30',
      default: 'bg-bg-3 text-ink-3 border-line-2',
    };
    const monoClass = this.mono() ? ' font-mono' : '';
    return `${base} ${toneClasses[this.tone()]}${monoClass}`;
  });
}
