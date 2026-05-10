import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * EmptyState — placeholder amigable cuando una lista/tabla está vacía.
 *
 * Estructura: ícono opcional (slot vía content projection), título serif,
 * mensaje sans, y un CTA opcional que emite `action`. Encajado en el design
 * system del proyecto (mono uppercase para chrome, serif para títulos).
 */
@Component({
  selector: 'app-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="flex flex-col items-center justify-center gap-3 py-12 px-6 text-center text-ink-3 dark:text-ink-5"
    >
      <div class="text-ink-4 dark:text-ink-5">
        <ng-content />
      </div>
      <h3 class="font-serif text-lg text-ink dark:text-bg m-0">{{ title() }}</h3>
      @if (message()) {
        <p class="text-sm max-w-[420px] m-0">{{ message() }}</p>
      }
      @if (ctaLabel()) {
        <button
          type="button"
          class="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-ink dark:bg-bg text-bg dark:text-ink font-mono text-xs uppercase tracking-wider hover:opacity-90 transition-opacity"
          (click)="action.emit()"
        >
          {{ ctaLabel() }}
        </button>
      }
    </div>
  `,
})
export class EmptyState {
  readonly title = input.required<string>();
  readonly message = input<string | null>(null);
  readonly ctaLabel = input<string | null>(null);
  readonly action = output<void>();
}
