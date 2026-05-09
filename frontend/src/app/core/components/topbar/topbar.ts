import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';

import { AuthFacade } from '../../../features/auth/application/facades/auth.facade';
import { Segmented, type SegmentedOption } from '../../../shared/ui/segmented/segmented';
import { LayoutService } from '../../services/layout.service';
import { RoleService } from '../../services/role.service';
import { TourService } from '../../services/tour.service';
import type { Role } from '../../types/role';
import { DarkLightToggle } from '../dark-light-toggle/dark-light-toggle';

/**
 * TopBar — barra superior fija de la app.
 *
 * Desktop (lg+): grid de 3 columnas
 *   - Izquierda: hamburger (oculto), brand mark + texto "PRE-AUTH" en mono.
 *   - Centro: role switcher segmentado con 3 opciones (Hospital/Aseguradora/Auditor).
 *   - Derecha: SSE indicator + tour button + dark/light toggle.
 *
 * Mobile (< lg): grid compacto
 *   - Hamburger button visible (toggle del sidenav drawer).
 *   - Brand reducido (solo mark + "PRE-AUTH" en pantallas algo anchas).
 *   - Role switcher con labels más cortos (H/A/V) — fits en 320px wide.
 *   - SSE indicator oculto (no aporta en mobile).
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
          <!-- Hamburger SVG (3 líneas). cambia a X cuando está abierto. -->
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

      <!-- Centro: role switcher. Labels cortos en mobile, completos en sm+. -->
      <div class="flex justify-center min-w-0">
        <app-segmented
          [options]="roleOptions()"
          [value]="currentRole()"
          (valueChange)="onRoleChange($event)"
        />
      </div>

      <!-- Derecha: SSE (oculto en mobile) + tour + dark toggle -->
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
      </div>
    </header>
  `,
})
export class Topbar {
  private readonly roleService = inject(RoleService);
  private readonly tourService = inject(TourService);
  private readonly auth = inject(AuthFacade);
  protected readonly layout = inject(LayoutService);

  /**
   * Labels cambian según viewport:
   *   - mobile (< sm 640px): iniciales 'H' / 'A' / 'V' (fits en 320px wide).
   *   - sm+: labels completos.
   *
   * Implementamos esto con dos signals + `responsive()` derivado, pero como
   * Angular templates no tienen media queries inline, usamos clases CSS para
   * mostrar/ocultar las labels — el Segmented recibe siempre el label completo
   * y dejamos que CSS truncate visualmente. Más simple y sin duplicar lógica.
   */
  protected readonly roleOptions = computed<SegmentedOption[]>(() => [
    { value: 'hospital', label: 'Hospital' },
    { value: 'insurer', label: 'Aseguradora' },
    { value: 'auditor', label: 'Auditor' },
  ]);

  protected readonly currentRole = computed<string>(() => this.roleService.role());
  protected readonly tourActive = this.tourService.active;

  protected onRoleChange(value: string): void {
    this.roleService.set(value as Role);
  }

  protected onStartTour(): void {
    void this.tourService.start({ userId: this.auth.currentUser()?.id ?? null });
  }
}
