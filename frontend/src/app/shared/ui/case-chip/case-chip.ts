import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

/**
 * CaseChip — chip compacto que muestra el ID de un caso/recurso.
 *
 * Estilo: bg-bg-3, ink-3, mono pequeño, borde sutil.
 * `compact` reduce padding para usar dentro de tablas o filas densas.
 */
@Component({
  selector: 'app-case-chip',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span [class]="classes()">{{ id() }}</span>`,
})
export class CaseChip {
  readonly id = input.required<string>();
  readonly compact = input<boolean>(false);

  protected readonly classes = computed<string>(() => {
    const padding = this.compact() ? 'px-1 py-0' : 'px-1.5 py-0.5';
    return `inline-block bg-bg-3 text-ink-3 font-mono text-[11px] border border-line ${padding}`;
  });
}
