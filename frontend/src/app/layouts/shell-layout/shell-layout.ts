import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { Sidenav } from '../../core/components/sidenav/sidenav';
import { Topbar } from '../../core/components/topbar/topbar';

/**
 * ShellLayout — layout principal de la app.
 *
 * Replica `.shell-grid` + `.shell` del prototipo: TopBar fijo arriba, sidenav
 * de 220px a la izquierda, main con scroll a la derecha. Cada feature monta
 * su contenido vía `<router-outlet />`.
 */
@Component({
  selector: 'app-shell-layout',
  standalone: true,
  imports: [RouterOutlet, Topbar, Sidenav],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen flex flex-col bg-bg dark:bg-ink text-ink dark:text-bg">
      <app-topbar />
      <div class="flex-1 grid grid-cols-[220px_1fr] overflow-hidden">
        <app-sidenav class="border-r border-line dark:border-ink-3 bg-surface dark:bg-ink-2" />
        <main class="overflow-auto p-6 bg-bg dark:bg-ink">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
})
export class ShellLayout {}
