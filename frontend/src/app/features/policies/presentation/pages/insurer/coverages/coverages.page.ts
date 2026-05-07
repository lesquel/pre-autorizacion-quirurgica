import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';

import { PageHeader } from '../../../../../../core/components';
import { SEED } from '../../../../../../shared/fixtures/seed';
import type { Coverage } from '../../../../domain/entities';
import { PoliciesFacade } from '../../../../application/facades/policies.facade';

interface EditableCoverage {
  policyNumber: string;
  procedureCode: string;
  covered: boolean;
  waitingDays: number;
  copay: number;
  requiredDocsText: string;  // joined; user edits as comma-separated
}

@Component({
  selector: 'app-insurer-coverages-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader],
  template: `
    <app-page-header
      title="Coberturas"
      subtitle="Edición masiva por póliza · reemplazo atómico al guardar."
    />

    <section class="px-7 py-6 flex flex-col gap-4">
      <div class="flex items-end gap-3">
        <label class="flex flex-col gap-1">
          <span class="font-mono text-[10px] uppercase tracking-wider text-ink-3 dark:text-ink-5">Póliza</span>
          <select
            class="px-3 py-2 bg-bg-2 dark:bg-ink-2 border border-line dark:border-ink-3 text-ink dark:text-bg font-mono text-sm focus:outline-none focus:border-info min-w-[280px]"
            [value]="selectedPolicy() ?? ''"
            (change)="selectedPolicy.set($any($event.target).value || null)"
          >
            <option value="">— elegir póliza —</option>
            @for (p of facade.policies(); track p.number) {
              <option [value]="p.number">{{ p.number }} · {{ p.plan }}</option>
            }
          </select>
        </label>

        @if (selectedPolicy()) {
          <button
            type="button"
            class="px-3 py-2 bg-bg-2 dark:bg-ink-2 border border-line dark:border-ink-3 text-ink dark:text-bg font-mono text-xs uppercase tracking-wider hover:bg-bg-3"
            (click)="addRow()"
          >
            + Agregar fila
          </button>
          <button
            type="button"
            class="px-3 py-2 bg-ink dark:bg-bg text-bg dark:text-ink font-mono text-xs uppercase tracking-wider disabled:opacity-50"
            [disabled]="saving()"
            (click)="save()"
          >
            {{ saving() ? 'Guardando…' : 'Guardar todo' }}
          </button>
        }
      </div>

      @if (saveError()) {
        <p class="text-error text-sm">{{ saveError() }}</p>
      }

      @if (selectedPolicy()) {
        <div class="bg-surface border border-line overflow-x-auto">
          <table class="w-full border-collapse text-[13px]">
            <thead>
              <tr class="border-b border-line bg-bg-2">
                <th class="text-left font-mono text-[11px] uppercase tracking-wider text-ink-3 px-3 py-2">Procedimiento (CIE-10)</th>
                <th class="text-left font-mono text-[11px] uppercase tracking-wider text-ink-3 px-3 py-2">Cubierto</th>
                <th class="text-right font-mono text-[11px] uppercase tracking-wider text-ink-3 px-3 py-2">Carencia (d)</th>
                <th class="text-right font-mono text-[11px] uppercase tracking-wider text-ink-3 px-3 py-2">Copago (USD)</th>
                <th class="text-left font-mono text-[11px] uppercase tracking-wider text-ink-3 px-3 py-2">Docs (separados por coma)</th>
                <th class="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              @for (row of working(); track $index; let i = $index) {
                <tr class="border-b border-line last:border-b-0 align-top">
                  <td class="px-3 py-2">
                    <input
                      type="text"
                      class="w-full px-2 py-1 bg-bg-2 dark:bg-ink-2 border border-line dark:border-ink-3 text-ink dark:text-bg font-mono text-sm"
                      [value]="row.procedureCode"
                      (input)="patch(i, { procedureCode: $any($event.target).value })"
                      placeholder="K80.20"
                    />
                  </td>
                  <td class="px-3 py-2">
                    <input
                      type="checkbox"
                      [checked]="row.covered"
                      (change)="patch(i, { covered: $any($event.target).checked })"
                    />
                  </td>
                  <td class="px-3 py-2">
                    <input
                      type="number"
                      min="0"
                      class="w-full px-2 py-1 bg-bg-2 dark:bg-ink-2 border border-line dark:border-ink-3 text-ink dark:text-bg font-mono text-sm text-right tabular-nums"
                      [value]="row.waitingDays"
                      (input)="patch(i, { waitingDays: toNumber($any($event.target).value) })"
                    />
                  </td>
                  <td class="px-3 py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      class="w-full px-2 py-1 bg-bg-2 dark:bg-ink-2 border border-line dark:border-ink-3 text-ink dark:text-bg font-mono text-sm text-right tabular-nums"
                      [value]="row.copay"
                      (input)="patch(i, { copay: toNumber($any($event.target).value) })"
                    />
                  </td>
                  <td class="px-3 py-2">
                    <input
                      type="text"
                      class="w-full px-2 py-1 bg-bg-2 dark:bg-ink-2 border border-line dark:border-ink-3 text-ink dark:text-bg text-sm"
                      [value]="row.requiredDocsText"
                      (input)="patch(i, { requiredDocsText: $any($event.target).value })"
                      placeholder="Informe médico, Eco abdominal"
                    />
                  </td>
                  <td class="px-3 py-2 text-right">
                    <button
                      type="button"
                      class="text-xs font-mono uppercase text-error hover:underline"
                      (click)="removeRow(i)"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6" class="px-3 py-6 text-center text-ink-4 text-sm">
                    No hay coberturas para esta póliza. Agregá una fila para empezar.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <p class="text-sm text-ink-3 dark:text-ink-5 m-0">
          Elegí una póliza para editar sus coberturas.
        </p>
      }
    </section>
  `,
})
export class InsurerCoveragesPage {
  protected readonly facade = inject(PoliciesFacade);

  protected readonly selectedPolicy = signal<string | null>(null);
  protected readonly working = signal<EditableCoverage[]>([]);
  protected readonly saving = signal<boolean>(false);
  protected readonly saveError = signal<string | null>(null);

  // Procedure name lookup (from SEED) for future enrichment if needed.
  // Kept private — not currently rendered, but available.
  protected readonly procedureNameByCode = computed<ReadonlyMap<string, string>>(
    () => new Map(SEED.procedures.map((p) => [p.code, p.name])),
  );

  constructor() {
    effect(() => {
      const sel = this.selectedPolicy();
      if (!sel) {
        this.working.set([]);
        return;
      }
      const fromCache = this.facade
        .coveragesForPolicy(sel)
        .map<EditableCoverage>((c) => ({
          policyNumber: c.policyNumber,
          procedureCode: c.procedureCode,
          covered: c.covered,
          waitingDays: c.waitingDays,
          copay: c.copay,
          requiredDocsText: c.requiredDocs.join(', '),
        }));
      this.working.set(fromCache);
    });
  }

  protected addRow(): void {
    const sel = this.selectedPolicy();
    if (!sel) return;
    this.working.update((arr) => [
      ...arr,
      {
        policyNumber: sel,
        procedureCode: '',
        covered: true,
        waitingDays: 0,
        copay: 0,
        requiredDocsText: '',
      },
    ]);
  }

  protected removeRow(idx: number): void {
    this.working.update((arr) => arr.filter((_, i) => i !== idx));
  }

  protected toNumber(v: string): number {
    return Number(v);
  }

  protected patch(idx: number, partial: Partial<EditableCoverage>): void {
    this.working.update((arr) =>
      arr.map((row, i) => (i === idx ? { ...row, ...partial } : row)),
    );
  }

  protected async save(): Promise<void> {
    const sel = this.selectedPolicy();
    if (!sel) return;
    this.saving.set(true);
    this.saveError.set(null);
    try {
      const coverages: Coverage[] = this.working().map((row) => ({
        policyNumber: row.policyNumber,
        procedureCode: row.procedureCode.trim(),
        covered: row.covered,
        waitingDays: row.waitingDays,
        copay: row.copay,
        requiredDocs: row.requiredDocsText
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0),
      }));
      await this.facade.replaceCoverages(sel, coverages);
    } catch (err) {
      this.saveError.set(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      this.saving.set(false);
    }
  }
}
