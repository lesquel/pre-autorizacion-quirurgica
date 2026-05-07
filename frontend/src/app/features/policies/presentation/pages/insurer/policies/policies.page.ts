import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';

import { PageHeader } from '../../../../../../core/components';
import { Pill } from '../../../../../../shared/ui';
import type { Insurer, Policy } from '../../../../domain/entities';
import { PoliciesFacade } from '../../../../application/facades/policies.facade';

/**
 * Row del listado — pre-resolvemos `insurerName` para que el template no haga
 * lookups por fila (el OnPush + computed garantiza que el mapeo se hace una sola
 * vez por cambio en `policies()`/`insurers()`).
 */
interface PolicyRow {
  readonly policy: Policy;
  readonly insurerName: string;
}

@Component({
  selector: 'app-insurer-policies-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, Pill],
  template: `
    <app-page-header title="Pólizas" subtitle="Gestión de pólizas" />

    <section class="px-7 py-6 flex flex-col gap-4">
      <!-- Banner MVP read-only (decisión D2 del PRD) -->
      <div
        class="bg-warn-bg text-warn border border-warn/30 p-3 rounded text-[12px]"
        role="status"
      >
        <strong class="font-mono uppercase tracking-wider mr-2">MVP read-only</strong>
        — la gestión completa (alta/baja/edición) llega en v1.1.
      </div>

      <div class="bg-surface border border-line overflow-x-auto">
        <table class="w-full border-collapse text-[13px]">
          <thead>
            <tr class="border-b border-line bg-bg-2">
              <th class="text-left font-mono text-[11px] uppercase tracking-wider text-ink-3 px-3 py-2">
                Número
              </th>
              <th class="text-left font-mono text-[11px] uppercase tracking-wider text-ink-3 px-3 py-2">
                Paciente
              </th>
              <th class="text-left font-mono text-[11px] uppercase tracking-wider text-ink-3 px-3 py-2">
                Plan
              </th>
              <th class="text-left font-mono text-[11px] uppercase tracking-wider text-ink-3 px-3 py-2">
                Aseguradora
              </th>
              <th class="text-left font-mono text-[11px] uppercase tracking-wider text-ink-3 px-3 py-2">
                Inicio
              </th>
              <th class="text-left font-mono text-[11px] uppercase tracking-wider text-ink-3 px-3 py-2">
                Fin
              </th>
              <th class="text-left font-mono text-[11px] uppercase tracking-wider text-ink-3 px-3 py-2">
                Estado
              </th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.policy.number) {
              <tr class="border-b border-line last:border-b-0">
                <td class="font-mono text-[12px] px-3 py-2.5">{{ row.policy.number }}</td>
                <td class="px-3 py-2.5 text-ink-3">{{ row.policy.patientId }}</td>
                <td class="px-3 py-2.5">{{ row.policy.plan }}</td>
                <td class="px-3 py-2.5">{{ row.insurerName }}</td>
                <td class="font-mono text-[12px] text-ink-3 px-3 py-2.5">{{ row.policy.startDate }}</td>
                <td class="font-mono text-[12px] text-ink-3 px-3 py-2.5">{{ row.policy.endDate }}</td>
                <td class="px-3 py-2.5">
                  <app-pill [text]="row.policy.status" [tone]="toneFor(row.policy.status)" />
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="7" class="px-3 py-6 text-center text-ink-4 text-sm">
                  No hay pólizas cargadas.
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
})
export class InsurerPoliciesPage {
  private readonly facade = inject(PoliciesFacade);

  /**
   * Pre-resolvemos un mapa `insurerId → name` para que el join sea O(1) por
   * fila. Si la lista de aseguradoras o pólizas cambia (no en MVP, pero el
   * contrato del facade es signal-based), el computed se recalcula solo.
   */
  private readonly insurerMap = computed<ReadonlyMap<string, Insurer>>(() => {
    const map = new Map<string, Insurer>();
    for (const i of this.facade.insurers()) {
      map.set(i.id, i);
    }
    return map;
  });

  protected readonly rows = computed<readonly PolicyRow[]>(() => {
    const insurers = this.insurerMap();
    return this.facade.policies().map((policy) => ({
      policy,
      insurerName: insurers.get(policy.insurerId)?.name ?? policy.insurerId,
    }));
  });

  /**
   * Tono del Pill según estado canónico de la póliza. Sólo `ACTIVE` aparece
   * en el SEED del MVP, pero modelamos los tres porque el dominio los expone.
   */
  protected toneFor(status: Policy['status']): 'ok' | 'warn' | 'err' {
    switch (status) {
      case 'ACTIVE':
        return 'ok';
      case 'SUSPENDED':
        return 'warn';
      case 'INACTIVE':
        return 'err';
    }
  }
}
