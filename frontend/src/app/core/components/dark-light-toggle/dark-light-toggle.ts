import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';

import { ThemeService } from '../../services/theme.service';

/**
 * DarkLightToggle — botón sol/luna que alterna el tema global.
 *
 * Inyecta `ThemeService`, lee el signal `theme` para decidir qué ícono mostrar
 * y delega el cambio en `themeService.toggle()`.
 */
@Component({
  selector: 'app-dark-light-toggle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      (click)="onToggle()"
      [attr.aria-label]="ariaLabel()"
      [title]="ariaLabel()"
      class="inline-flex items-center justify-center p-1.5 border border-line dark:border-ink-3 bg-surface dark:bg-ink-2 text-ink-2 dark:text-bg hover:bg-bg-3 dark:hover:bg-ink transition-colors"
    >
      @if (isDark()) {
        <!-- Luna -->
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
        </svg>
      } @else {
        <!-- Sol -->
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="m4.93 4.93 1.41 1.41" />
          <path d="m17.66 17.66 1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="m6.34 17.66-1.41 1.41" />
          <path d="m19.07 4.93-1.41 1.41" />
        </svg>
      }
    </button>
  `,
})
export class DarkLightToggle {
  private readonly themeService = inject(ThemeService);

  protected readonly isDark = computed(
    () => this.themeService.theme() === 'dark',
  );

  protected readonly ariaLabel = computed(() =>
    this.isDark() ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro',
  );

  protected onToggle(): void {
    this.themeService.toggle();
  }
}
