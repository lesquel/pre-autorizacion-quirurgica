import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';

import { PageHeader } from '../../../../../../core/components';
import { SEED } from '../../../../../../shared/fixtures/seed';
import { formatCurrency } from '../../../../../../shared/helpers';
import { Pill } from '../../../../../../shared/ui';
import type { Coverage } from '../../../../domain/entities';
import { PoliciesFacade } from '../../../../application/facades/policies.facade';

interface CoverageRow {
  readonly coverage: Coverage;
  readonly procedureName: string;
  readonly copayDisplay: string;
}

interface PolicyGroup {
  readonly policyNumber: string;
  readonly rows: readonly CoverageRow[];
}

@Component({
  selector: 'app-insurer-coverages-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, Pill],
  template: `
    <app-page-header
      title="Coberturas"
      subtitle="Matriz de coberturas por póliza"
    />

    <section class="px-7 py-6 flex flex-col gap-4">
      <!-- Banner MVP read-only (decisión D2 del PRD) -->
      <div
        class="bg-warn-bg text-warn border border-warn/30 p-3 rounded text-[12px]"
        role="status"
      >
        <strong class="font-mono uppercase tracking-wider mr-2">MVP read-only</strong>
        — la gestión completa (alta/baja/edición) llega en v1.1.
      </div>

      @for (group of groups(); track group.policyNumber) {
        <div class="bg-surface border border-line">
          <header
            class="flex items-baseline justify-between px-4 py-2.5 border-b border-line bg-bg-2"
          >
            <h2 class="font-mono text-[12px] uppercase tracking-wider text-ink m-0">
              {{ group.policyNumber }}
            </h2>
            <span class="font-mono text-[10px] uppercase tracking-wider text-ink-4">
              {{ group.rows.length }} procedimiento(s)
            </span>
          </header>

          <div class="overflow-x-auto">
            <table class="w-full border-collapse text-[13px]">
              <thead>
                <tr class="border-b border-line">
                  <th class="text-left font-mono text-[11px] uppercase tracking-wider text-ink-3 px-3 py-2">
                    Procedimiento
                  </th>
                  <th class="text-left font-mono text-[11px] uppercase tracking-wider text-ink-3 px-3 py-2">
                    Cubierto
                  </th>
                  <th class="text-right font-mono text-[11px] uppercase tracking-wider text-ink-3 px-3 py-2">
                    Carencia
                  </th>
                  <th class="text-right font-mono text-[11px] uppercase tracking-wider text-ink-3 px-3 py-2">
                    Copago
                  </th>
                  <th class="text-left font-mono text-[11px] uppercase tracking-wider text-ink-3 px-3 py-2">
                    Docs requeridos
                  </th>
                </tr>
              </thead>
              <tbody>
                @for (row of group.rows; track row.coverage.procedureCode) {
                  <tr class="border-b border-line last:border-b-0 align-top">
                    <td class="px-3 py-2.5">
                      <div class="font-mono text-[11px] text-ink-4">
                        {{ row.coverage.procedureCode }}
                      </div>
                      <div>{{ row.procedureName }}</div>
                    </td>
                    <td class="px-3 py-2.5">
                      @if (row.coverage.covered) {
                        <span class="text-ok" aria-label="Cubierto">&#10003;</span>
                      } @else {
                        <span class="text-err" aria-label="No cubierto">&#10007;</span>
                      }
                    </td>
                    <td class="text-right font-mono tabular-nums px-3 py-2.5">
                      {{ row.coverage.waitingDays }}d
                    </td>
                    <td class="text-right font-mono tabular-nums px-3 py-2.5">
                      {{ row.copayDisplay }}
                    </td>
                    <td class="px-3 py-2.5">
                      <div class="flex flex-wrap gap-1">
                        @for (doc of row.coverage.requiredDocs; track doc) {
                          <app-pill [text]="doc" tone="default" />
                        }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      } @empty {
        <p class="text-sm text-ink-3 m-0">No hay coberturas cargadas.</p>
      }
    </section>
  `,
})
export class InsurerCoveragesPage {
  private readonly facade = inject(PoliciesFacade);

  /**
   * Mapa `code → procedureName` resuelto contra el SEED. Las definiciones de
   * procedimientos viven en SEED y no son reactivas (catálogo estático), por
   * eso lo construimos a nivel de instancia.
   */
  private readonly procedureNameByCode: ReadonlyMap<string, string> = new Map(
    SEED.procedures.map((p) => [p.code, p.name]),
  );

  /**
   * Agrupamos por `policyNumber` preservando el orden de aparición en el SEED.
   * `Map<string, CoverageRow[]>` mantiene insertion order y nos da agrupado +
   * orden estable en una sola pasada — más legible que `reduce` con objetos.
   */
  protected readonly groups = computed<readonly PolicyGroup[]>(() => {
    const buckets = new Map<string, CoverageRow[]>();

    for (const coverage of this.facade.coverages()) {
      const procedureName =
        this.procedureNameByCode.get(coverage.procedureCode) ??
        'Sin match en catálogo';

      const row: CoverageRow = {
        coverage,
        procedureName,
        copayDisplay: formatCurrency(coverage.copay),
      };

      const existing = buckets.get(coverage.policyNumber);
      if (existing) {
        existing.push(row);
      } else {
        buckets.set(coverage.policyNumber, [row]);
      }
    }

    return Array.from(buckets, ([policyNumber, rows]) => ({
      policyNumber,
      rows,
    }));
  });
}
