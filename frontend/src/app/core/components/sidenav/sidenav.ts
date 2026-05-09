import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { LayoutService } from '../../services/layout.service';
import { RoleService } from '../../services/role.service';
import type { Role } from '../../types/role';

interface NavItem {
  readonly id: string;
  readonly label: string;
  readonly path: string;
}

const NAV_ITEMS: Record<Role, readonly NavItem[]> = {
  hospital: [
    { id: 'submit', label: 'Submit', path: '/hospital/submit' },
    { id: 'live-run', label: 'Live Run', path: '/hospital/live-run' },
    { id: 'cases', label: 'Cases', path: '/hospital/cases' },
    { id: 'procedures', label: 'Procedures', path: '/hospital/procedures' },
  ],
  insurer: [
    { id: 'dashboard', label: 'Dashboard', path: '/insurer/dashboard' },
    { id: 'cases', label: 'Cases', path: '/insurer/cases' },
    { id: 'policies', label: 'Policies', path: '/insurer/policies' },
    { id: 'coverages', label: 'Coverages', path: '/insurer/coverages' },
  ],
  auditor: [
    { id: 'tray', label: 'Tray', path: '/auditor/tray' },
    { id: 'resolved', label: 'Resolved', path: '/auditor/resolved' },
  ],
};

/**
 * SideNav — navegación lateral por rol.
 *
 * Lee el rol activo desde `RoleService` y renderiza el listado correspondiente.
 * Cada item es un `routerLink` con `routerLinkActive` para resaltar la ruta
 * actual. Si llegan `counts`, muestra un contador discreto a la derecha.
 *
 * En mobile cierra el drawer al hacer click en un link (vía LayoutService);
 * en desktop el sidenav está siempre visible y closeSidenav() es no-op visual.
 */
@Component({
  selector: 'app-sidenav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav
      id="app-sidenav"
      class="h-full w-full py-4 overflow-y-auto bg-bg-2 dark:bg-ink-2 text-ink-2 dark:text-ink-5"
    >
      <div class="px-4">
        <div
          class="font-mono text-[10px] uppercase tracking-wider text-ink-4 dark:text-ink-5 mb-2 pb-1.5 border-b border-line dark:border-ink-3"
        >
          {{ groupLabel() }}
        </div>

        @for (item of items(); track item.id) {
          <a
            [routerLink]="item.path"
            routerLinkActive="bg-surface dark:bg-ink text-ink dark:text-bg border-l-accent"
            class="flex items-center justify-between px-2 py-2 -mx-2 font-mono text-xs text-ink-2 dark:text-ink-5 border-l-2 border-transparent hover:bg-bg-3 dark:hover:bg-ink transition-colors"
            (click)="onLinkClick()"
          >
            <span>{{ item.label }}</span>
            @if (countFor(item.id); as count) {
              <span class="text-[10px] text-ink-4 dark:text-ink-5">{{ count }}</span>
            }
          </a>
        }
      </div>
    </nav>
  `,
})
export class Sidenav {
  private readonly roleService = inject(RoleService);
  private readonly layout = inject(LayoutService);

  readonly counts = input<Record<string, number> | undefined>(undefined);

  protected readonly items = computed<readonly NavItem[]>(
    () => NAV_ITEMS[this.roleService.role()],
  );

  protected readonly groupLabel = computed<string>(() => {
    const role = this.roleService.role();
    if (role === 'hospital') return 'Hospital';
    if (role === 'insurer') return 'Aseguradora';
    return 'Auditor';
  });

  protected countFor(id: string): number | null {
    const map = this.counts();
    if (!map) return null;
    const value = map[id];
    return typeof value === 'number' ? value : null;
  }

  /**
   * En mobile el sidenav es un drawer; cerrarlo en cada click evita que se
   * quede flotando sobre el contenido tras navegar. En desktop no hay drawer
   * abierto, así que `closeSidenav()` solo escribe `false` en la signal —
   * la grid del shell ignora ese flag en `lg+`.
   */
  protected onLinkClick(): void {
    this.layout.closeSidenav();
  }
}
