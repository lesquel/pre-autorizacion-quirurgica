import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { Sidenav } from '../../core/components/sidenav/sidenav';
import { Topbar } from '../../core/components/topbar/topbar';
import { LayoutService } from '../../core/services/layout.service';

/**
 * ShellLayout — layout principal de la app.
 *
 * Desktop (lg+, ≥1024px): TopBar fijo arriba, sidenav 220px a la izquierda en
 * grid, main scrolleable a la derecha (igual que el prototipo original).
 *
 * Mobile (< lg): sidenav off-canvas (drawer izquierdo absolute, slide-in con
 * `translate-x`), backdrop semi-transparente al lado, topbar con hamburger
 * que toggle el drawer. Esto evita que el sidenav fijo de 220px coma la mitad
 * de la pantalla en mobile.
 *
 * El estado del drawer vive en `LayoutService` para que topbar/sidenav lo
 * lean sin pasar callbacks.
 */
@Component({
  selector: 'app-shell-layout',
  standalone: true,
  imports: [RouterOutlet, Topbar, Sidenav],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-dvh flex flex-col bg-bg dark:bg-ink text-ink dark:text-bg">
      <app-topbar />

      <!-- Container principal: en lg+ es grid; en mobile el sidenav es drawer absolute. -->
      <div class="relative flex-1 lg:grid lg:grid-cols-[220px_1fr] overflow-hidden">
        <!-- Backdrop (solo mobile, solo cuando drawer abierto). Click cierra. -->
        @if (layout.sidenavOpen()) {
          <button
            type="button"
            aria-label="Cerrar menú"
            class="lg:hidden fixed inset-0 top-13 z-30 bg-ink/40 dark:bg-ink/60"
            (click)="layout.closeSidenav()"
          ></button>
        }

        <!-- Sidenav: drawer en mobile (translate-x), fijo en desktop. -->
        <app-sidenav
          class="fixed lg:static top-13 bottom-0 left-0 z-40 w-[260px] lg:w-auto
                 transform transition-transform duration-200 ease-out
                 border-r border-line dark:border-ink-3
                 bg-surface dark:bg-ink-2"
          [class.translate-x-0]="layout.sidenavOpen()"
          [class.-translate-x-full]="!layout.sidenavOpen()"
          [class.lg:translate-x-0]="true"
        />

        <!-- Main scrollable. Padding responsive: 16px mobile, 24px lg+. -->
        <main class="overflow-auto p-4 sm:p-5 lg:p-6 bg-bg dark:bg-ink">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
})
export class ShellLayout {
  protected readonly layout = inject(LayoutService);
}
