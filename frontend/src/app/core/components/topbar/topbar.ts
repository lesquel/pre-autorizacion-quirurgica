import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';

import { AuthFacade } from '../../../features/auth/application/facades/auth.facade';
import { Segmented, type SegmentedOption } from '../../../shared/ui/segmented/segmented';
import { LayoutService } from '../../services/layout.service';
import { RoleService } from '../../services/role.service';
import { TourService } from '../../services/tour.service';
import type { Role } from '../../types/role';
import { DarkLightToggle } from '../dark-light-toggle/dark-light-toggle';

/**
 * TopBar — barra superior fija de la app autenticada.
 *
 * Desktop (lg+): grid de 3 columnas
 *   - Izquierda: hamburger (oculto en lg+), brand mark + texto "PRE-AUTH".
 *   - Centro: role switcher segmentado (Hospital/Aseguradora/Auditor).
 *   - Derecha: SSE indicator + tour + dark/light toggle + logout.
 *
 * Mobile (< lg): hamburger visible, brand reducido, switcher con labels cortos.
 *
 * Para el demo/MVP, cualquier cuenta autenticada puede saltar entre los 3
 * dashboards desde acá — no validamos rol del JWT vs URL. Cerrar sesión
 * vuelve al /login.
 */
@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [Segmented, DarkLightToggle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header
      class="sticky top-0 z-50 grid grid-cols-[auto_1fr_auto] items-center gap-2 sm:gap-4 lg:gap-6 h-13 px-3 sm:px-5 bg-surface dark:bg-ink border-b border-line dark:border-ink-3"
    >
      <!-- Izquierda: hamburger (mobile) + brand -->
      <div class="flex items-center gap-2 sm:gap-2.5 font-mono text-[11px] uppercase tracking-wider text-ink dark:text-bg">
        <button
          type="button"
          class="lg:hidden inline-grid place-items-center w-9 h-9 -ml-1 text-ink-3 dark:text-ink-5 hover:text-ink dark:hover:text-bg transition-colors"
          [attr.aria-expanded]="layout.sidenavOpen()"
          aria-controls="app-sidenav"
          aria-label="Abrir menú"
          (click)="layout.toggleSidenav()"
        >
          @if (layout.sidenavOpen()) {
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <line x1="6" y1="6" x2="18" y2="18"/>
              <line x1="18" y1="6" x2="6" y2="18"/>
            </svg>
          } @else {
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <line x1="4" y1="7" x2="20" y2="7"/>
              <line x1="4" y1="12" x2="20" y2="12"/>
              <line x1="4" y1="17" x2="20" y2="17"/>
            </svg>
          }
        </button>
        <div
          class="grid place-items-center w-[22px] h-[22px] bg-ink dark:bg-bg text-bg dark:text-ink"
        >
          <span class="block w-2 h-2 bg-accent" aria-hidden="true"></span>
        </div>
        <span class="hidden sm:inline">PRE-AUTH</span>
      </div>

      <!-- Centro: role switcher (Hospital/Aseguradora/Auditor) -->
      <div class="flex justify-center min-w-0">
        <app-segmented
          [options]="roleOptions()"
          [value]="currentRole()"
          (valueChange)="onRoleChange($event)"
        />
      </div>

      <!-- Derecha: SSE + tour + dark toggle + logout -->
      <div class="flex items-center gap-2 sm:gap-3">
        <span
          class="hidden md:inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-ink-3 dark:text-ink-5"
          title="Stream en vivo"
        >
          <span
            class="inline-block w-1.5 h-1.5 rounded-full bg-ok animate-pulse"
            aria-hidden="true"
          ></span>
          SSE
        </span>
        @if (userEmail(); as email) {
          <span
            class="hidden lg:inline font-mono text-[11px] text-ink-3 dark:text-ink-5 truncate max-w-[200px]"
            [title]="email"
          >
            {{ email }}
          </span>
        }
        <button
          type="button"
          class="inline-grid place-items-center w-7 h-7 border border-line dark:border-ink-3 text-ink-3 dark:text-ink-5 hover:text-ink dark:hover:text-bg hover:border-ink-4 transition-colors font-mono text-[12px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          [disabled]="tourActive()"
          (click)="onStartTour()"
          aria-label="Iniciar tour guiado"
          title="Tour guiado del demo"
        >
          ?
        </button>
        <app-dark-light-toggle />
        <button
          type="button"
          class="hidden sm:inline-flex items-center px-3 py-1.5 border border-line dark:border-ink-3 text-ink-3 dark:text-ink-5 hover:text-ink dark:hover:text-bg hover:border-ink-4 transition-colors font-mono text-[10px] uppercase tracking-wider"
          (click)="onLogout()"
          title="Cerrar sesión"
        >
          Salir
        </button>
      </div>
    </header>
  `,
})
export class Topbar {
  private readonly roleService = inject(RoleService);
  private readonly tourService = inject(TourService);
  private readonly auth = inject(AuthFacade);
  private readonly router = inject(Router);
  protected readonly layout = inject(LayoutService);

  protected readonly roleOptions = computed<SegmentedOption[]>(() => [
    { value: 'hospital', label: 'Hospital' },
    { value: 'insurer', label: 'Aseguradora' },
    { value: 'auditor', label: 'Auditor' },
  ]);

  protected readonly currentRole = computed<string>(() => this.roleService.role());
  protected readonly userEmail = computed<string | null>(
    () => this.auth.currentUser()?.email ?? null,
  );
  protected readonly tourActive = this.tourService.active;

  protected onRoleChange(value: string): void {
    this.roleService.set(value as Role);
  }

  protected onStartTour(): void {
    void this.tourService.start({ userId: this.auth.currentUser()?.id ?? null });
  }

  protected onLogout(): void {
    this.auth.logout();
    this.roleService.clearOverride();
    void this.router.navigate(['/login']);
  }
}
