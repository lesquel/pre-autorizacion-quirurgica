import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';

import { PageHeader } from '../../../../../../core/components/page-header/page-header';
import { SEED, type DemoScenarioKey } from '../../../../../../shared/fixtures/seed';
import type { Outcome } from '../../../../domain/value-objects/outcome';
import { AuthorizationCasesFacade } from '../../../../application/facades/authorization-cases.facade';
import {
  MedicalReportForm,
  type MedicalReportFormPrefill,
  type MedicalReportFormSubmit,
} from '../../../components/medical-report-form/medical-report-form';
import {
  ScenarioPicker,
  type DemoScenario,
} from '../../../components/scenario-picker/scenario-picker';
import type { MedicalReport } from '../../../../domain/entities/medical-report';

/**
 * Descripciones y outcomes esperados por escenario — porteado de
 * `view-hospital.jsx::SCENARIO_DESCRIPTIONS` y mapeado a `Outcome` del dominio.
 */
const SCENARIO_META: Readonly<
  Record<DemoScenarioKey, { description: string; expectedOutcome: Outcome }>
> = {
  APPROVED_AUTO: {
    description:
      'Cobertura cumplida y documentación completa — el agente pre-aprueba en segundos.',
    expectedOutcome: 'APPROVED_AUTO',
  },
  DOCS_REQUESTED: {
    description:
      'Cobertura OK pero faltan documentos del set requerido por la póliza.',
    expectedOutcome: 'DOCS_REQUESTED',
  },
  ESCALATED_WAITING: {
    description:
      'La carencia no se cumple. Por política, el agente nunca rechaza: escala a auditor.',
    expectedOutcome: 'ESCALATED',
  },
  ESCALATED_LOW_CONF: {
    description:
      'Informe ambiguo: ningún procedimiento supera el umbral de match. Escala a auditor.',
    expectedOutcome: 'ESCALATED',
  },
  ESCALATED_PDF_FAIL: {
    description:
      'PDF escaneado no extraíble con calidad mínima. Escala a auditor.',
    expectedOutcome: 'ESCALATED',
  },
};

/**
 * HospitalSubmitPage — página de envío de pre-autorizaciones.
 *
 * Flujo:
 *   1. Usuario elige un escenario de demo (opcional) → prefill al form.
 *   2. Usuario edita y envía → construimos `MedicalReport` entity y llamamos
 *      `facade.submitCase`.
 *   3. Navegamos a `/hospital/live-run` para ver la corrida en vivo.
 *
 * El `scenarioKey` se conserva por separado y se pasa al `submitCase` como
 * override determinístico para que el agente mock siga el rail del escenario
 * elegido (cuando el usuario cambia el form a mano, perdemos el scenarioKey
 * sólo si elige otro escenario o resetea — lo mantenemos sticky).
 */
@Component({
  selector: 'app-hospital-submit-page',
  standalone: true,
  imports: [PageHeader, ScenarioPicker, MedicalReportForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header
      title="Nueva pre-autorización"
      subtitle="Elegí un escenario de demo o cargá un caso a mano. El agente corre en vivo y emite una decisión auditable."
      [breadcrumbs]="['Hospital', 'Pre-autorización']"
    />

    <section class="px-7 py-6 flex flex-col gap-6 max-w-[1200px]">
      <div class="flex flex-col gap-2">
        <span
          class="font-mono text-[10px] uppercase tracking-wider text-ink-4"
        >
          1 · Escenario de demo
        </span>
        <app-scenario-picker
          [scenarios]="scenarios()"
          (select)="onScenarioSelect($event)"
        />
      </div>

      <div class="flex flex-col gap-2">
        <span
          class="font-mono text-[10px] uppercase tracking-wider text-ink-4"
        >
          2 · Datos del caso
        </span>
        <app-medical-report-form
          [prefill]="prefill()"
          [submitting]="submitting()"
          (submit)="onSubmit($event)"
        />
      </div>
    </section>
  `,
})
export class HospitalSubmitPage {
  private readonly facade = inject(AuthorizationCasesFacade);
  private readonly router = inject(Router);

  protected readonly prefill = signal<MedicalReportFormPrefill | undefined>(
    undefined,
  );
  protected readonly submitting = signal(false);

  private readonly _scenarioKey = signal<DemoScenarioKey | undefined>(undefined);

  protected readonly scenarios = computed<readonly DemoScenario[]>(() =>
    (Object.entries(SEED.demoCases) as [DemoScenarioKey, typeof SEED.demoCases[DemoScenarioKey]][])
      .map(([key, c]) => ({
        key,
        label: c.label,
        description: SCENARIO_META[key].description,
        expectedOutcome: SCENARIO_META[key].expectedOutcome,
        patientId: c.patientId,
        policyNumber: c.policyNumber,
        procedureCode: c.procedureCode,
        format: c.format,
        report: c.report,
        attachedDocs: c.attachedDocs,
      })),
  );

  protected onScenarioSelect(s: DemoScenario): void {
    this._scenarioKey.set(s.key);
    this.prefill.set({
      patientId: s.patientId,
      policyNumber: s.policyNumber,
      format: s.format === 'PDF' ? 'pdf' : 'text',
      content: s.report,
      procedureSolicitedHint: s.procedureCode === '?' ? undefined : s.procedureCode,
    });
  }

  protected onSubmit(input: MedicalReportFormSubmit): void {
    if (this.submitting()) {
      return;
    }
    this.submitting.set(true);

    const report: MedicalReport = {
      id: generateReportId(),
      patientId: input.patientId,
      format: input.report.format,
      content: input.report.content,
      procedureSolicitedHint: input.report.procedureSolicitedHint,
      diagnosis: input.report.diagnosis,
      attendingDoctor: input.report.attendingDoctor,
      submittedAt: new Date().toISOString(),
    };

    this.facade.submitCase({
      report,
      policyNumber: input.policyNumber,
      scenarioKey: this._scenarioKey(),
      file: input.file,
    });

    // Navegamos al live-run inmediatamente: la facade ya inicializó
    // `currentRun` en `running` antes de retornar (es síncrono).
    void this.router.navigate(['/hospital/live-run']).finally(() => {
      this.submitting.set(false);
    });
  }
}

function generateReportId(): string {
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `R-${Date.now()}-${suffix}`;
}
