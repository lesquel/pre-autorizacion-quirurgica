import {
  ChangeDetectionStrategy,
  Component,
  computed,
} from '@angular/core';

import { PageHeader } from '../../../../../../core/components/page-header/page-header';
import { SEED } from '../../../../../../shared/fixtures/seed';
import type { Procedure } from '../../../../../../shared/domain/entities';

/**
 * HospitalProceduresPage — catálogo de procedimientos CIE-10.
 *
 * Render: tabla simple con código (mono), nombre, categoría y carencia típica.
 * Lectura directa de `SEED.procedures` (lista cerrada del prototipo).
 */
@Component({
  selector: 'app-hospital-procedures-page',
  standalone: true,
  imports: [PageHeader],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header
      title="Catálogo CIE-10"
      subtitle="Procedimientos quirúrgicos cubiertos. La carencia típica es referencial — la cobertura efectiva depende de la póliza."
      [breadcrumbs]="['Hospital', 'Procedimientos']"
    />

    <section class="px-7 py-6">
      <div
        class="bg-surface dark:bg-ink border border-line dark:border-ink-3 overflow-x-auto"
      >
        <table class="w-full text-left">
          <thead>
            <tr
              class="text-[11px] font-mono uppercase tracking-wider text-ink-4 border-b border-line dark:border-ink-3"
            >
              <th class="px-4 py-2.5 font-normal">Código</th>
              <th class="px-4 py-2.5 font-normal">Nombre</th>
              <th class="px-4 py-2.5 font-normal">Categoría</th>
              <th class="px-4 py-2.5 font-normal">Carencia típica</th>
            </tr>
          </thead>
          <tbody>
            @for (p of procedures(); track p.code) {
              <tr class="border-b last:border-b-0 border-line dark:border-ink-3">
                <td class="px-4 py-3 font-mono text-sm text-ink dark:text-bg">
                  {{ p.code }}
                </td>
                <td class="px-4 py-3 text-sm text-ink dark:text-bg">
                  {{ p.name }}
                </td>
                <td class="px-4 py-3 text-sm text-ink-3 dark:text-ink-5">
                  {{ p.category }}
                </td>
                <td
                  class="px-4 py-3 font-mono text-[11px] text-ink-3 dark:text-ink-5 tabular-nums"
                >
                  {{ formatWaiting(p.waitingDaysTypical) }}
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
})
export class HospitalProceduresPage {
  protected readonly procedures = computed<readonly Procedure[]>(
    () => SEED.procedures,
  );

  protected formatWaiting(days: number): string {
    if (days === 0) {
      return 'Sin carencia (urgencia)';
    }
    if (days < 365) {
      return `${days} días`;
    }
    if (days === 365) {
      return '1 año';
    }
    const years = Math.floor(days / 365);
    return `${years} años`;
  }
}
