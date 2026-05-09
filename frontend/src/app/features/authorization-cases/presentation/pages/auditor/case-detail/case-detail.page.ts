import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

import { PageHeader } from '../../../../../../core/components';
import {
  findCoverage,
  findPatient,
  findPolicy,
} from '../../../../../../shared/domain/helpers/finders';
import { SEED, type DemoCase } from '../../../../../../shared/fixtures';
import { OutcomePill } from '../../../../../../shared/ui';
import { AuthorizationCasesFacade } from '../../../../application/facades/authorization-cases.facade';
import { CaseRepository } from '../../../../domain/ports/case-repository.port';
import type { TraceStep } from '../../../../domain/value-objects/trace-step';
import { AgentTraceViewer, DecisionPanel } from '../../../components';

type ResolutionOutcome = 'APPROVED' | 'REJECTED';

/**
 * AuditorCaseDetailPage — detalle del caso escalado con form de resolución.
 *
 * - Reactivo a cambios de `route.params['id']` (toSignal + effect → facade.selectCase).
 * - Resuelve patient/policy/coverage/report desde SEED via finders puros.
 * - Form de resolución: outcome (radio), message (textarea), reasoning (textarea).
 *   Se valida que los tres campos estén presentes antes de habilitar "Resolver".
 * - El demoCase con `format` y `report` se busca por `policyNumber` (el caso del
 *   dominio no persiste el texto del informe, sólo `reportId`). Si no hay match,
 *   la card del informe muestra un placeholder.
 */
@Component({
  selector: 'app-auditor-case-detail-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, OutcomePill, AgentTraceViewer, DecisionPanel],
  template: `
    <div class="flex flex-col gap-5">
      <app-page-header
        [title]="headerTitle()"
        [subtitle]="headerSubtitle()"
        [breadcrumbs]="['Auditor', 'Bandeja', caseId() ?? '']"
      >
        @if (case_(); as c) {
          <app-outcome-pill [outcome]="c.decision?.outcome ?? 'PENDING'" />
        }
        <button
          type="button"
          (click)="goBack()"
          class="px-3 py-1.5 text-xs font-mono uppercase tracking-wider bg-surface dark:bg-ink border border-line dark:border-ink-3 text-ink dark:text-bg hover:border-ink-4"
        >
          ← Volver
        </button>
      </app-page-header>

      @if (!case_()) {
        <div class="mx-7 p-6 bg-surface dark:bg-ink border border-line dark:border-ink-3 text-ink-3 dark:text-ink-5">
          <div class="font-mono text-[11px] uppercase tracking-wider text-ink-4 mb-2">
            Caso no encontrado
          </div>
          <p class="text-sm">
            No existe un caso con el id <code class="font-mono">{{ caseId() }}</code>.
            Es posible que haya sido eliminado o que el enlace esté desactualizado.
          </p>
        </div>
      } @else if (case_(); as c) {
        <div class="px-0 lg:px-7 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- IZQUIERDA: contexto clínico/contractual -->
          <div class="flex flex-col gap-4">
            <article class="bg-surface dark:bg-ink border border-line dark:border-ink-3 p-4">
              <h3 class="font-mono text-[11px] uppercase tracking-wider text-ink-4 mb-3">
                Paciente
              </h3>
              @if (patient(); as p) {
                <div class="flex flex-col gap-1.5 text-sm">
                  <div class="text-ink dark:text-bg font-medium">{{ p.name }}</div>
                  <div class="font-mono text-xs text-ink-3 dark:text-ink-5">
                    DNI {{ p.dni }} · {{ p.sex }} · {{ p.dob }}
                  </div>
                </div>
              } @else {
                <div class="text-sm text-ink-4">— sin datos del paciente</div>
              }
            </article>

            <article class="bg-surface dark:bg-ink border border-line dark:border-ink-3 p-4">
              <h3 class="font-mono text-[11px] uppercase tracking-wider text-ink-4 mb-3">
                Póliza
              </h3>
              @if (policy(); as p) {
                <div class="flex flex-col gap-1.5 text-sm">
                  <div class="font-mono text-ink dark:text-bg">{{ p.number }}</div>
                  <div class="text-ink-3 dark:text-ink-5">{{ p.plan }}</div>
                  <div class="font-mono text-xs text-ink-4">
                    {{ p.startDate }} → {{ p.endDate }} · {{ p.status }}
                  </div>
                  @if (insurerName(); as ins) {
                    <div class="text-xs text-ink-3 dark:text-ink-5">{{ ins }}</div>
                  }
                </div>
              } @else {
                <div class="text-sm text-ink-4">— sin datos de la póliza</div>
              }
            </article>

            <article class="bg-surface dark:bg-ink border border-line dark:border-ink-3 p-4">
              <h3 class="font-mono text-[11px] uppercase tracking-wider text-ink-4 mb-3">
                Informe médico
              </h3>
              @if (demo(); as d) {
                <div class="flex items-center gap-2 mb-2">
                  <span class="font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 bg-bg-3 text-ink-3 border border-line">
                    {{ d.format }}
                  </span>
                  <span class="font-mono text-xs text-ink-4">
                    {{ formattedDate() }}
                  </span>
                </div>
                <pre class="font-mono text-[12px] leading-relaxed text-ink-2 dark:text-ink-5 whitespace-pre-wrap bg-bg-3 dark:bg-ink-2 border border-line dark:border-ink-3 p-3 max-h-64 overflow-auto m-0">{{ reportPreview() }}</pre>
              } @else {
                <div class="text-sm text-ink-4">
                  Informe no disponible — el documento original sólo vive en el
                  storage del hospital.
                </div>
              }
            </article>
          </div>

          <!-- DERECHA: trace + decision -->
          <div class="flex flex-col gap-4">
            <app-agent-trace-viewer [trace]="traceSteps()" />
            @if (c.decision; as d) {
              <app-decision-panel [decision]="d" />
            }
          </div>
        </div>

        <!-- RESOLUCIÓN del auditor -->
        @if (c.status === 'ESCALADO') {
          <section class="mx-7 bg-surface dark:bg-ink border border-line dark:border-ink-3 p-5">
            <header class="flex items-baseline justify-between mb-4">
              <h2 class="font-serif text-xl text-ink dark:text-bg m-0">
                Resolución del auditor
              </h2>
              <span class="font-mono text-[10px] uppercase tracking-wider text-ink-4">
                queda en el record permanente
              </span>
            </header>

            <form (submit)="$event.preventDefault(); submit()" class="flex flex-col gap-4">
              <fieldset class="flex flex-col gap-2">
                <legend class="font-mono text-[11px] uppercase tracking-wider text-ink-4 mb-1">
                  Decisión
                </legend>
                <div class="flex gap-2">
                  <label
                    [class]="outcomeChipClasses('APPROVED')"
                  >
                    <input
                      type="radio"
                      name="outcome"
                      value="APPROVED"
                      [checked]="resolutionOutcome() === 'APPROVED'"
                      (change)="setOutcome('APPROVED')"
                      class="sr-only"
                    />
                    Aprobar
                  </label>
                  <label
                    [class]="outcomeChipClasses('REJECTED')"
                  >
                    <input
                      type="radio"
                      name="outcome"
                      value="REJECTED"
                      [checked]="resolutionOutcome() === 'REJECTED'"
                      (change)="setOutcome('REJECTED')"
                      class="sr-only"
                    />
                    Rechazar
                  </label>
                </div>
              </fieldset>

              <label class="flex flex-col gap-1.5">
                <span class="font-mono text-[11px] uppercase tracking-wider text-ink-4">
                  Mensaje al hospital
                </span>
                <textarea
                  rows="2"
                  [value]="message()"
                  (input)="setMessage($any($event.target).value)"
                  placeholder="Mensaje breve que verá el hospital."
                  class="bg-bg-3 dark:bg-ink-2 border border-line dark:border-ink-3 p-3 text-sm font-sans text-ink dark:text-bg focus:outline-none focus:border-ink-4"
                ></textarea>
              </label>

              <label class="flex flex-col gap-1.5">
                <span class="font-mono text-[11px] uppercase tracking-wider text-ink-4">
                  Justificación clínica
                </span>
                <textarea
                  rows="6"
                  [value]="reasoning()"
                  (input)="setReasoning($any($event.target).value)"
                  placeholder="Detalle clínico-administrativo de la decisión. Esto queda en el record permanente y será visible para Hospital y Aseguradora."
                  class="bg-bg-3 dark:bg-ink-2 border border-line dark:border-ink-3 p-3 text-sm font-sans text-ink dark:text-bg focus:outline-none focus:border-ink-4"
                ></textarea>
              </label>

              <div class="flex items-center justify-between pt-2 border-t border-line dark:border-ink-3">
                <span class="font-mono text-[10px] uppercase tracking-wider text-ink-4">
                  Auditor: Dra. C. Reinoso · MP 9182
                </span>
                <button
                  type="submit"
                  [disabled]="!formValid()"
                  class="px-4 py-2 text-xs font-mono uppercase tracking-wider bg-ink dark:bg-bg text-bg dark:text-ink disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
                >
                  Resolver caso →
                </button>
              </div>
            </form>
          </section>
        } @else if (c.status === 'DECIDIDO' && c.decision; as d) {
          <section class="mx-7 bg-surface dark:bg-ink border border-line dark:border-ink-3 p-5">
            <header class="flex items-baseline justify-between mb-4">
              <h2 class="font-serif text-xl text-ink dark:text-bg m-0">
                Resolución
              </h2>
              <span class="font-mono text-[10px] uppercase tracking-wider text-ink-4">
                {{ d.decidedBy === 'auditor' ? 'cerrado por auditor' : 'cerrado por el agente' }}
              </span>
            </header>
            <div class="flex flex-col gap-3">
              <div>
                <div class="font-mono text-[11px] uppercase tracking-wider text-ink-4 mb-1">
                  Justificación
                </div>
                <p class="text-sm text-ink-2 dark:text-ink-5 whitespace-pre-wrap m-0">
                  {{ d.rationale }}
                </p>
              </div>
              @if (c.decidedAt) {
                <div class="font-mono text-[10px] uppercase tracking-wider text-ink-4">
                  Decidido el {{ c.decidedAt }}
                </div>
              }
            </div>
          </section>
        }
      }
    </div>
  `,
})
export class AuditorCaseDetailPage {
  private readonly facade = inject(AuthorizationCasesFacade);
  private readonly caseRepository = inject(CaseRepository);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  /** id reactivo del caso vía toSignal sobre route.params. */
  private readonly params = toSignal(this.route.params, {
    initialValue: this.route.snapshot.params,
  });
  protected readonly caseId = computed<string | null>(() => {
    const raw = (this.params() as Record<string, string | undefined>)['id'];
    return typeof raw === 'string' && raw.length > 0 ? raw : null;
  });

  protected readonly case_ = this.facade.selectedCase;

  // Lookups en el SEED — finders puros + arrays del seed.
  protected readonly patient = computed(() => {
    const c = this.case_();
    if (!c) return undefined;
    // El reportId no expone el patientId acá, así que vamos por la póliza.
    const pol = findPolicy(c.policyNumber, SEED.policies);
    if (!pol) return undefined;
    return findPatient(pol.patientId, SEED.patients);
  });
  protected readonly policy = computed(() => {
    const c = this.case_();
    return c ? findPolicy(c.policyNumber, SEED.policies) : undefined;
  });
  protected readonly insurerName = computed(() => {
    const pol = this.policy();
    if (!pol) return undefined;
    return SEED.insurers.find((i) => i.id === pol.insurerId)?.name;
  });
  /** demoCase del SEED que coincide con la póliza (mejor esfuerzo). */
  protected readonly demo = computed<DemoCase | undefined>(() => {
    const c = this.case_();
    if (!c) return undefined;
    return Object.values(SEED.demoCases).find(
      (d) => d.policyNumber === c.policyNumber,
    );
  });
  protected readonly coverage = computed(() => {
    const c = this.case_();
    const d = this.demo();
    if (!c || !d) return undefined;
    return findCoverage(
      { policyNumber: c.policyNumber, procedureCode: d.procedureCode },
      SEED.coverages,
    );
  });

  protected readonly formattedDate = computed(() => {
    const c = this.case_();
    if (!c) return '';
    return c.createdAt.slice(0, 10);
  });
  protected readonly reportPreview = computed(() => {
    const d = this.demo();
    return d ? d.report : '';
  });

  protected readonly headerTitle = computed(() => {
    const id = this.caseId();
    return id ? `Caso ${id}` : 'Caso';
  });
  protected readonly headerSubtitle = computed(() => {
    const c = this.case_();
    if (!c) return undefined;
    const reason = c.decision?.escalationReason;
    return reason ? `Escalado por ${reason}` : 'Detalle del caso';
  });

  // ---- form de resolución ----
  protected readonly resolutionOutcome = signal<ResolutionOutcome | null>(null);
  protected readonly message = signal('');
  protected readonly reasoning = signal('');
  protected readonly formValid = computed(
    () =>
      this.resolutionOutcome() !== null &&
      this.message().trim().length > 0 &&
      this.reasoning().trim().length > 0,
  );

  /**
   * Pasos de la traza del agente para el caso actual.
   *
   * El listado de casos del backend NO trae `agentTrace` (payload chico),
   * así que lo pedimos por separado a `/cases/{id}/trace` cuando el id
   * del route cambia. Si la llamada falla dejamos el array vacío y el
   * `<app-agent-trace-viewer>` muestra su empty state.
   */
  protected readonly traceSteps = signal<readonly TraceStep[]>([]);

  /**
   * Nonce monotónico para invalidar respuestas stale.
   *
   * Comparar contra `caseId()` no alcanza: si el user navega A → B → A
   * suficientemente rápido, la respuesta tardía de la PRIMERA carga de A
   * pasa el guard `caseId() === id` cuando vuelve, y pisa el resultado
   * fresco de la segunda carga. Cada disparo del effect captura el nonce
   * actual; al recibir, comparamos contra el nonce vigente y descartamos
   * si difiere.
   */
  private loadTraceNonce = 0;

  constructor() {
    // Sincroniza la selección con el id del route param.
    effect(() => {
      const id = this.caseId();
      // Cada effect run reserva un nuevo nonce — incluso si el id no cambia,
      // cualquier carga en vuelo previa queda invalidada.
      const myNonce = ++this.loadTraceNonce;
      if (id) {
        this.facade.selectCase(id);
        // No await — el effect es síncrono; cargamos el trace en background
        // y el signal se actualiza cuando llega la respuesta. Reset previo
        // para evitar mostrar el trace de un caso anterior durante la espera.
        this.traceSteps.set([]);
        void this.loadTraceFor(id, myNonce);
      } else {
        this.facade.clearSelection();
        this.traceSteps.set([]);
      }
    });
  }

  private async loadTraceFor(id: string, nonce: number): Promise<void> {
    try {
      const trace = await this.caseRepository.loadTrace(id);
      // Si llegó un effect run posterior, su nonce >> el nuestro: descartamos.
      if (nonce !== this.loadTraceNonce) return;
      this.traceSteps.set(trace);
    } catch {
      // Empty state ("Esperando primer paso del agente…") cubre el fallo.
      if (nonce === this.loadTraceNonce) this.traceSteps.set([]);
    }
  }

  protected setOutcome(value: ResolutionOutcome): void {
    this.resolutionOutcome.set(value);
  }
  protected setMessage(value: string): void {
    this.message.set(value);
  }
  protected setReasoning(value: string): void {
    this.reasoning.set(value);
  }

  protected outcomeChipClasses(value: ResolutionOutcome): string {
    const base =
      'inline-flex items-center px-3 py-1.5 text-xs font-mono uppercase tracking-wider border cursor-pointer transition-colors';
    return this.resolutionOutcome() === value
      ? `${base} bg-ink text-bg border-ink dark:bg-bg dark:text-ink dark:border-bg`
      : `${base} bg-surface text-ink-3 border-line hover:border-ink-4 dark:bg-ink dark:text-ink-5 dark:border-ink-3`;
  }

  protected submit(): void {
    if (!this.formValid()) return;
    const id = this.caseId();
    const outcome = this.resolutionOutcome();
    if (!id || !outcome) return;
    this.facade.resolveCase({
      caseId: id,
      outcome,
      message: this.message().trim(),
      reasoning: this.reasoning().trim(),
    });
    void this.router.navigate(['/auditor/tray']);
  }

  protected goBack(): void {
    void this.router.navigate(['/auditor/tray']);
  }
}
