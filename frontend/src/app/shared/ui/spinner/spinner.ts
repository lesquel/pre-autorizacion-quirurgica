import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Spinner — indicador de carga circular.
 *
 * Tamaños: `sm` (16px), `md` (24px), `lg` (32px). Usa `currentColor` para
 * heredar el color del contenedor — así sirve tanto sobre fondos claros como
 * oscuros sin variantes.
 */
@Component({
  selector: 'app-spinner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="px()"
      [attr.height]="px()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      class="animate-spin"
      aria-hidden="true"
    >
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  `,
})
export class Spinner {
  readonly size = input<'sm' | 'md' | 'lg'>('md');

  protected px(): number {
    switch (this.size()) {
      case 'sm':
        return 16;
      case 'lg':
        return 32;
      default:
        return 24;
    }
  }
}
