import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';

import { timeAgo, formatDuration } from '../../../../../shared/helpers';
import { SEED } from '../../../../../shared/fixtures/seed';
import { CaseChip } from '../../../../../shared/ui/case-chip/case-chip';
import { Confidence } from '../../../../../shared/ui/confidence/confidence';
import { OutcomePill } from '../../../../../shared/ui/outcome-pill/outcome-pill';
import type { AuthorizationCase } from '../../../domain/entities/authorization-case';
import type { CaseStatus } from '../../../domain/value-objects/case-status';
import type { Outcome } from '../../../domain/value-objects/outcome';

export type CaseTableMode = 'hospital' | 'insurer' | 'auditor';

interface CaseRow {
  readonly id: string;
  readonly outcome: Outcome;
  readonly confidence?: number;
  readonly procedure: string;
  readonly insurer?: string;
  readonly createdAt: string;
  readonly lastDurationMs?: number;
  readonly escalationReason?: string;
}

/**
 * CaseTable — tabla compacta reusable de casos de autorización.
 *
 * Columnas según `mode`:
 * - hospital / insurer: ID, Estado, Confianza, Procedimiento, Hace, Duración.
 *   `insurer` agrega Aseguradora cuando es resoluble.
 * - auditor: ID, Estado, Confianza, Procedimiento, Hace, Motivo escalamiento.
 *
 * Click en fila → emite `caseClicked` con el id del caso.
 */
@Component({
  selector: 'app-case-table',
  standalone: true,
  imports: [CaseChip, Confidence, OutcomePill],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (rows().length === 0) {
      <div class="text-center text-sm text-ink-4 py-12">No hay casos</div>
    } @else {
      <!-- Cards en mobile (< md). Cada card mantiene los mismos datos que la tabla
           pero stacked vertically con etiquetas a la izquierda. Mejor lectura
           en pantalla angosta que un overflow-x-auto donde el usuario tiene que
           scrollear horizontal. -->
      <div class="md:hidden flex flex-col gap-2">
        @for (row of rows(); track row.id) {
          <button
            type="button"
            class="w-full text-left p-3 border border-line dark:border-ink-3 bg-surface dark:bg-ink-2 hover:border-ink-4 dark:hover:border-ink-4 transition-colors flex flex-col gap-2"
            (click)="caseClicked.emit(row.id)"
          >
            <div class="flex items-center justify-between gap-2">
              <app-case-chip [id]="row.id" />
              <app-outcome-pill [outcome]="row.outcome" />
            </div>
            <div class="text-sm text-ink dark:text-bg leading-snug">
              {{ row.procedure }}
            </div>
            <div
              class="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] font-mono text-ink-3 dark:text-ink-5"
            >
              <div class="flex items-center gap-1.5">
                <span class="text-ink-4 dark:text-ink-5 uppercase tracking-wider">conf:</span>
                @if (row.confidence != null) {
                  <app-confidence [value]="row.confidence" />
                } @else {
                  <span>—</span>
                }
              </div>
              <div class="flex items-center gap-1.5 justify-end">
                <span class="text-ink-4 dark:text-ink-5 uppercase tracking-wider">hace</span>
                <span class="tabular-nums">{{ timeAgo(row.createdAt) }}</span>
              </div>
              @if (mode() === 'insurer') {
                <div class="col-span-2 truncate">
                  <span class="text-ink-4 dark:text-ink-5 uppercase tracking-wider">aseg.:</span>
                  {{ row.insurer ?? '—' }}
                </div>
              }
              @if (mode() === 'auditor') {
                <div class="col-span-2 truncate">
                  <span class="text-ink-4 dark:text-ink-5 uppercase tracking-wider">esc.:</span>
                  {{ row.escalationReason ?? '—' }}
                </div>
              } @else {
                <div class="col-span-2 flex items-center gap-1.5 justify-end tabular-nums">
                  <span class="text-ink-4 dark:text-ink-5 uppercase tracking-wider">dur.</span>
                  @if (row.lastDurationMs != null) {
                    {{ formatDuration(row.lastDurationMs) }}
                  } @else {
                    <span>—</span>
                  }
                </div>
              }
            </div>
          </button>
        }
      </div>

      <!-- Tabla en md+ (≥768px). Mismo markup que antes — sin cambios. -->
      <div class="hidden md:block w-full overflow-x-auto">
        <table class="w-full text-left">
          <thead>
            <tr
              class="text-[11px] font-mono uppercase tracking-wider text-ink-4 border-b border-line"
            >
              <th class="px-3 py-2 font-normal">ID</th>
              <th class="px-3 py-2 font-normal">Estado</th>
              <th class="px-3 py-2 font-normal">Confianza</th>
              <th class="px-3 py-2 font-normal">Procedimiento</th>
              @if (mode() === 'insurer') {
                <th class="px-3 py-2 font-normal">Aseguradora</th>
              }
              <th class="px-3 py-2 font-normal">Hace</th>
              @if (mode() === 'auditor') {
                <th class="px-3 py-2 font-normal">Motivo escalamiento</th>
              } @else {
                <th class="px-3 py-2 font-normal">Duración</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.id) {
              <tr
                class="border-b border-line hover:bg-bg-2 cursor-pointer transition-colors"
                (click)="caseClicked.emit(row.id)"
              >
                <td class="px-3 py-2.5">
                  <app-case-chip [id]="row.id" />
                </td>
                <td class="px-3 py-2.5">
                  <app-outcome-pill [outcome]="row.outcome" />
                </td>
                <td class="px-3 py-2.5">
                  @if (row.confidence != null) {
                    <app-confidence [value]="row.confidence" />
                  } @else {
                    <span class="text-ink-4 text-sm">—</span>
                  }
                </td>
                <td class="px-3 py-2.5 text-sm text-ink dark:text-bg">
                  {{ row.procedure }}
                </td>
                @if (mode() === 'insurer') {
                  <td class="px-3 py-2.5 text-sm text-ink-3 dark:text-ink-5">
                    {{ row.insurer ?? '—' }}
                  </td>
                }
                <td
                  class="px-3 py-2.5 font-mono text-[11px] text-ink-3 dark:text-ink-5"
                >
                  {{ timeAgo(row.createdAt) }}
                </td>
                @if (mode() === 'auditor') {
                  <td
                    class="px-3 py-2.5 font-mono text-[11px] text-ink-3 dark:text-ink-5"
                  >
                    {{ row.escalationReason ?? '—' }}
                  </td>
                } @else {
                  <td
                    class="px-3 py-2.5 font-mono text-[11px] text-ink-3 dark:text-ink-5 tabular-nums"
                  >
                    @if (row.lastDurationMs != null) {
                      {{ formatDuration(row.lastDurationMs) }}
                    } @else {
                      —
                    }
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
})
export class CaseTable {
  readonly cases = input.required<readonly AuthorizationCase[]>();
  readonly mode = input<CaseTableMode>('hospital');
  readonly caseClicked = output<string>();

  protected readonly timeAgo = timeAgo;
  protected readonly formatDuration = formatDuration;

  protected readonly rows = computed<readonly CaseRow[]>(() =>
    this.cases().map((c) => buildRow(c)),
  );
}

function buildRow(c: AuthorizationCase): CaseRow {
  const lastStep = c.agentTrace.length
    ? c.agentTrace[c.agentTrace.length - 1]
    : undefined;
  return {
    id: c.id,
    outcome: outcomeFromCase(c),
    confidence: c.decision?.confidence,
    procedure: procedureLabel(c),
    insurer: insurerLabel(c.policyNumber),
    createdAt: c.createdAt,
    lastDurationMs: lastStep?.durationMs,
    escalationReason: c.decision?.escalationReason ?? undefined,
  };
}

function outcomeFromCase(c: AuthorizationCase): Outcome {
  if (c.decision) {
    return c.decision.outcome;
  }
  return outcomeFromStatus(c.status);
}

function outcomeFromStatus(status: CaseStatus): Outcome {
  switch (status) {
    case 'APROBADO_AUTO':
      return 'APPROVED_AUTO';
    case 'DOCS_PEDIDOS':
      return 'DOCS_REQUESTED';
    case 'ESCALADO':
      return 'ESCALATED';
    case 'DECIDIDO':
      return 'DECIDED';
    case 'PENDIENTE':
      return 'PENDING';
  }
}

function procedureLabel(c: AuthorizationCase): string {
  // El hint del informe no está disponible acá (sólo guardamos reportId).
  // Resolvemos vía evidencia o coverage match en SEED como mejor esfuerzo.
  const fromEvidence = c.decision?.evidence.find((e) => e.field
    .toLowerCase()
    .includes('procedim'))?.quote;
  if (fromEvidence) {
    return fromEvidence;
  }
  const coverage = SEED.coverages.find((cov) => cov.policyNumber === c.policyNumber);
  if (coverage) {
    const proc = SEED.procedures.find((p) => p.code === coverage.procedureCode);
    if (proc) {
      return `${proc.code} · ${proc.name}`;
    }
  }
  return '—';
}

function insurerLabel(policyNumber: string): string | undefined {
  const policy = SEED.policies.find((p) => p.number === policyNumber);
  if (!policy) {
    return undefined;
  }
  return SEED.insurers.find((i) => i.id === policy.insurerId)?.name;
}
