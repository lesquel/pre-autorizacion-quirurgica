import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * PageHeader — header de página con breadcrumbs, título, subtítulo y slot de acciones.
 *
 * Replica `.page-header` del prototipo: breadcrumbs en mono uppercase (separados
 * por "/"), título serif grande, subtítulo discreto. El slot proyectado por
 * `<ng-content>` permite acciones a la derecha (botones).
 */
@Component({
  selector: 'app-page-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header
      class="grid grid-cols-[1fr_auto] items-end gap-6 px-7 pt-5 pb-4 bg-surface dark:bg-ink border-b border-line dark:border-ink-3"
    >
      <div>
        @if (breadcrumbs()?.length) {
          <div
            class="flex items-center font-mono text-[11px] uppercase tracking-wider text-ink-4 dark:text-ink-5 mb-2"
          >
            @for (crumb of breadcrumbs(); track $index; let last = $last) {
              <span>{{ crumb }}</span>
              @if (!last) {
                <span class="mx-2 text-ink-5 dark:text-ink-4" aria-hidden="true">/</span>
              }
            }
          </div>
        }

        <h1
          class="font-serif text-2xl font-semibold tracking-tight leading-tight text-ink dark:text-bg m-0"
        >
          {{ title() }}
        </h1>

        @if (subtitle()) {
          <p class="text-ink-3 dark:text-ink-5 text-sm max-w-[60ch] mt-1 mb-0">
            {{ subtitle() }}
          </p>
        }
      </div>

      <div class="flex items-center gap-2">
        <ng-content />
      </div>
    </header>
  `,
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly subtitle = input<string | undefined>(undefined);
  readonly breadcrumbs = input<readonly string[] | undefined>(undefined);
}
