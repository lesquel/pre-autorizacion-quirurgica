import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  type Signal,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import type { Role } from '../../../../core/types/role';
import type { AuthorizationCase } from '../../domain/entities/authorization-case';
import type { MedicalReport } from '../../domain/entities/medical-report';
import { CaseRepository } from '../../domain/ports/case-repository.port';
import type { AgentDecision } from '../../domain/value-objects/agent-decision';
import type { TraceStep } from '../../domain/value-objects/trace-step';
import { GetCaseByIdUseCase } from '../use-cases/get-case-by-id.use-case';
import {
  filterByRole,
  ListCasesUseCase,
} from '../use-cases/list-cases.use-case';
import {
  ResolveCaseUseCase,
  type ResolveCaseInput,
} from '../use-cases/resolve-case.use-case';
import {
  SubmitCaseUseCase,
  type SubmitCaseInput,
} from '../use-cases/submit-case.use-case';

/**
 * CurrentRun — estado en vivo de la corrida del agente para el caso recién enviado.
 *
 * - `caseId`   : id del caso creado.
 * - `trace`    : pasos terminales acumulados (no incluye los `running`).
 * - `decision` : presente cuando llegó `done`.
 * - `status`   : 'running' mientras llegan steps, 'done' al recibir `done`,
 *                'error' si el agente falló (caso queda escalado).
 * - `error`    : mensaje del fallo cuando status === 'error'.
 */
export interface CurrentRun {
  readonly caseId: string;
  readonly trace: readonly TraceStep[];
  readonly decision?: AgentDecision;
  readonly status: 'running' | 'done' | 'error';
  readonly error?: string;
}

/**
 * AuthorizationCasesFacade — única superficie pública para el feature
 * desde la capa de presentación.
 *
 * Estado vía signals (todo readonly al exterior):
 * - `cases`        : lista completa, viene del repo.
 * - `currentRun`   : corrida en vivo del último submit (o null).
 * - `selectedCase` : caso seleccionado para detalle (o undefined).
 *
 * Los Observables del agente se suscriben acá con `takeUntilDestroyed(destroyRef)`
 * — la UI consume signals, jamás Observables. Esto desacopla la presentación
 * del transporte (cuando llegue el backend real con WebSockets/SSE, sólo
 * cambia el adapter).
 */
@Injectable({ providedIn: 'root' })
export class AuthorizationCasesFacade {
  private readonly repository = inject(CaseRepository);
  private readonly submitCaseUC = inject(SubmitCaseUseCase);
  private readonly resolveCaseUC = inject(ResolveCaseUseCase);
  private readonly listCasesUC = inject(ListCasesUseCase);
  private readonly getCaseByIdUC = inject(GetCaseByIdUseCase);
  private readonly destroyRef = inject(DestroyRef);

  readonly cases = this.repository.cases;

  private readonly _currentRun = signal<CurrentRun | null>(null);
  readonly currentRun = this._currentRun.asReadonly();

  private readonly _selectedCaseId = signal<string | null>(null);
  readonly selectedCase: Signal<AuthorizationCase | undefined> = computed(() => {
    const id = this._selectedCaseId();
    if (!id) {
      return undefined;
    }
    // Computed sobre `cases` para reactividad: si el caso se actualiza,
    // selectedCase se recomputa. NO usamos getCaseByIdUC acá porque el use
    // case devuelve snapshot, no reactivo.
    return this.cases().find((c) => c.id === id);
  });

  /**
   * Envía un caso nuevo. La UI lee `currentRun` para ver el progreso —
   * NO devolvemos Observable a propósito (presentación consume signals).
   */
  submitCase(input: SubmitCaseInput): void {
    const { caseId, events$ } = this.submitCaseUC.execute(input);

    this._currentRun.set({
      caseId,
      trace: [],
      status: 'running',
    });

    events$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        const current = this._currentRun();
        if (!current || current.caseId !== caseId) {
          // Otro submit ya tomó el lugar — ignoramos eventos viejos.
          return;
        }

        if (event.kind === 'step') {
          if (event.step.state === 'running') {
            // No persistimos steps `running` — el repo ya tiene la traza
            // terminal acumulada vía el use case.
            return;
          }
          this._currentRun.set({
            ...current,
            trace: [...current.trace, event.step],
          });
          return;
        }

        if (event.kind === 'done') {
          this._currentRun.set({
            ...current,
            trace: event.trace,
            decision: event.decision,
            status: 'done',
          });
          return;
        }

        // event.kind === 'error'
        this._currentRun.set({
          ...current,
          trace: event.trace,
          status: 'error',
          error: event.error,
        });
      });
  }

  clearRun(): void {
    this._currentRun.set(null);
  }

  selectCase(id: string): void {
    this._selectedCaseId.set(id);
  }

  clearSelection(): void {
    this._selectedCaseId.set(null);
  }

  /**
   * Auditor cierra un caso escalado. Limpia la selección para que la UI
   * vuelva a la bandeja sin caso abierto.
   */
  resolveCase(input: ResolveCaseInput): void {
    this.resolveCaseUC.execute(input);
    this.clearSelection();
  }

  /**
   * Devuelve un computed reactivo filtrado por el `role` que recibe como signal.
   * Útil para que cada vista (hospital/insurer/auditor) reciba sólo lo suyo
   * sin tener que recomputar manualmente.
   */
  casesForRole(role: Signal<Role>): Signal<readonly AuthorizationCase[]> {
    return computed(() => filterByRole(this.cases(), role()));
  }

  /** Snapshot helper para tests / casos que NO necesitan reactividad. */
  listCasesSnapshot(role?: Role): readonly AuthorizationCase[] {
    return this.listCasesUC.execute(role ? { role } : undefined);
  }

  /** Snapshot helper — útil cuando la UI ya tiene el id por router param. */
  getCaseByIdSnapshot(id: string): AuthorizationCase | undefined {
    return this.getCaseByIdUC.execute(id);
  }
}
