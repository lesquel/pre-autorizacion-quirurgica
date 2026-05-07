import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';

import { Segmented, type SegmentedOption } from '../../../shared/ui/segmented/segmented';
import { RoleService } from '../../services/role.service';
import type { Role } from '../../types/role';
import { DarkLightToggle } from '../dark-light-toggle/dark-light-toggle';

/**
 * TopBar — barra superior fija de la app.
 *
 * Replica `.appbar` del prototipo (grid de 3 columnas):
 *  - Izquierda: brand mark + texto "PRE-AUTH" en mono.
 *  - Centro: role switcher (segmented control) que delega en RoleService.
 *  - Derecha: indicador SSE pulsante + DarkLightToggle.
 */
@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [Segmented, DarkLightToggle],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header
      class="sticky top-0 z-50 grid grid-cols-[auto_1fr_auto] items-center gap-6 h-13 px-5 bg-surface dark:bg-ink border-b border-line dark:border-ink-3"
    >
      <!-- Brand -->
      <div class="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-wider text-ink dark:text-bg">
        <div
          class="grid place-items-center w-[22px] h-[22px] bg-ink dark:bg-bg text-bg dark:text-ink"
        >
          <span class="block w-2 h-2 bg-accent" aria-hidden="true"></span>
        </div>
        <span>PRE-AUTH</span>
      </div>

      <!-- Role switcher -->
      <div class="flex justify-center">
        <app-segmented
          [options]="roleOptions"
          [value]="currentRole()"
          (valueChange)="onRoleChange($event)"
        />
      </div>

      <!-- Acciones derecha -->
      <div class="flex items-center gap-3">
        <span
          class="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-ink-3 dark:text-ink-5"
          title="Stream en vivo"
        >
          <span
            class="inline-block w-1.5 h-1.5 rounded-full bg-ok animate-pulse"
            aria-hidden="true"
          ></span>
          SSE
        </span>
        <app-dark-light-toggle />
      </div>
    </header>
  `,
})
export class Topbar {
  private readonly roleService = inject(RoleService);

  protected readonly roleOptions: SegmentedOption[] = [
    { value: 'hospital', label: 'Hospital' },
    { value: 'insurer', label: 'Aseguradora' },
    { value: 'auditor', label: 'Auditor' },
  ];

  protected readonly currentRole = computed<string>(() => this.roleService.role());

  protected onRoleChange(value: string): void {
    this.roleService.set(value as Role);
  }
}
