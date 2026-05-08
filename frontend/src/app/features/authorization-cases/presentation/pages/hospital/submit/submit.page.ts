import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { PageHeader } from '../../../../../../core/components/page-header/page-header';
import { SEED, type DemoScenarioKey } from '../../../../../../shared/fixtures/seed';
import type { Outcome } from '../../../../domain/value-objects/outcome';
import { AuthorizationCasesFacade } from '../../../../application/facades/authorization-cases.facade';
import {
  DocumentExtractService,
  type MedicalPdfExtractDto,
  type PolicyPdfExtractDto,
} from '../../../../infrastructure/services/document-extract.service';
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
import { ApiError } from '../../../../../../shared/api/errors/api-error';

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

@Component({
  selector: 'app-hospital-submit-page',
  standalone: true,
  imports: [PageHeader, ScenarioPicker, MedicalReportForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header
      title="Nueva pre-autorización"
      subtitle="Subí el informe médico (hospital) y la póliza (aseguradora) en PDF: extraemos datos con IA y completamos el formulario. El caso se persiste en Notion cuando el backend tiene NOTION_TOKEN y las DB configuradas."
      [breadcrumbs]="['Hospital', 'Pre-autorización']"
    />

    <section class="px-7 py-6 flex flex-col gap-6 max-w-[1200px]">
      @if (intakeError()) {
        <div
          role="alert"
          class="flex gap-2 items-start px-3 py-2.5 border border-err/35 bg-err-bg text-err text-sm"
        >
          <span class="shrink-0 font-mono text-xs" aria-hidden="true">!</span>
          <span>{{ intakeError() }}</span>
        </div>
      }

      <div class="flex flex-col gap-3">
        <div class="flex flex-col gap-1">
          <span class="font-mono text-[10px] uppercase tracking-wider text-ink-4 dark:text-ink-5">
            1 · Documentos PDF
          </span>
          <p class="text-sm text-ink-3 dark:text-ink-5 m-0 max-w-3xl leading-relaxed">
            Informe médico según <span class="font-mono text-xs">docs/informe-medico-template.md</span>
            y póliza del paciente según
            <span class="font-mono text-xs">docs/poliza-paciente-template.md</span>. Requiere
            <span class="font-mono text-xs">GOOGLE_API_KEY</span> en el servidor para la extracción automática.
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            class="flex flex-col gap-2 p-4 border border-line dark:border-ink-3 bg-surface dark:bg-ink-2"
          >
            <span class="font-mono text-[10px] uppercase tracking-wider text-ink-3 dark:text-ink-5">
              Hospital · informe médico
            </span>
            <p class="text-xs text-ink-3 dark:text-ink-5 m-0">
              PDF del informe clínico. Al procesar, se completan diagnóstico, médico, CIE-10 y se fija envío en modo PDF.
            </p>
            <input
              #medicalInput
              type="file"
              accept="application/pdf"
              class="sr-only"
              [disabled]="intakeBusy() !== null"
              (change)="onMedicalFileInput($event)"
            />
            <button
              type="button"
              class="mt-1 px-4 py-8 border border-dashed border-line-2 dark:border-ink-3 bg-bg-2 dark:bg-ink hover:border-accent transition-colors font-mono text-xs uppercase tracking-wider text-ink-3 dark:text-ink-5 disabled:opacity-45"
              [disabled]="intakeBusy() !== null"
              (click)="medicalInput.click()"
            >
              @if (intakeBusy() === 'medical') {
                Extrayendo datos…
              } @else if (lastMedicalName()) {
                Listo: {{ lastMedicalName() }} — tocá para cambiar
              } @else {
                Elegir o soltar PDF del informe
              }
            </button>
          </div>

          <div
            class="flex flex-col gap-2 p-4 border border-line dark:border-ink-3 bg-surface dark:bg-ink-2"
          >
            <span class="font-mono text-[10px] uppercase tracking-wider text-ink-3 dark:text-ink-5">
              Aseguradora · póliza del paciente
            </span>
            <p class="text-xs text-ink-3 dark:text-ink-5 m-0">
              PDF de póliza o certificado. Completa número de póliza e identificación del paciente cuando el modelo las detecta.
            </p>
            <input
              #policyInput
              type="file"
              accept="application/pdf"
              class="sr-only"
              [disabled]="intakeBusy() !== null"
              (change)="onPolicyFileInput($event)"
            />
            <button
              type="button"
              class="mt-1 px-4 py-8 border border-dashed border-line-2 dark:border-ink-3 bg-bg-2 dark:bg-ink hover:border-accent transition-colors font-mono text-xs uppercase tracking-wider text-ink-3 dark:text-ink-5 disabled:opacity-45"
              [disabled]="intakeBusy() !== null"
              (click)="policyInput.click()"
            >
              @if (intakeBusy() === 'policy') {
                Extrayendo datos…
              } @else if (lastPolicyName()) {
                Listo: {{ lastPolicyName() }} — tocá para cambiar
              } @else {
                Elegir o soltar PDF de póliza
              }
            </button>
          </div>
        </div>
      </div>

      <details
        class="rounded border border-line dark:border-ink-3 bg-bg-2/60 dark:bg-ink-2/40 overflow-hidden open:shadow-sm"
      >
        <summary
          class="cursor-pointer select-none px-4 py-3 font-mono text-[10px] uppercase tracking-wider text-ink-3 dark:text-ink-5 hover:bg-bg-3/80 dark:hover:bg-ink transition-colors list-none flex items-center justify-between gap-2"
        >
          <span>Escenarios demo (opcional)</span>
          <span class="text-[10px] opacity-70">▼</span>
        </summary>
        <div class="px-4 pb-4 pt-0 border-t border-line dark:border-ink-3">
          <p class="text-xs text-ink-3 dark:text-ink-5 mt-3 mb-3 m-0">
            Solo para pruebas rápidas del agente con datos ficticios. El flujo real es por PDF arriba.
          </p>
          <app-scenario-picker [scenarios]="scenarios()" (select)="onScenarioSelect($event)" />
        </div>
      </details>

      <div class="flex flex-col gap-2">
        <span class="font-mono text-[10px] uppercase tracking-wider text-ink-4 dark:text-ink-5">
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
  private readonly extractApi = inject(DocumentExtractService);

  protected readonly prefill = signal<MedicalReportFormPrefill | undefined>(undefined);
  protected readonly submitting = signal(false);
  protected readonly intakeBusy = signal<'medical' | 'policy' | null>(null);
  protected readonly intakeError = signal<string | null>(null);
  protected readonly lastMedicalName = signal<string | null>(null);
  protected readonly lastPolicyName = signal<string | null>(null);

  private readonly _scenarioKey = signal<DemoScenarioKey | undefined>(undefined);

  protected readonly scenarios = computed<readonly DemoScenario[]>(() =>
    (Object.entries(SEED.demoCases) as [DemoScenarioKey, (typeof SEED.demoCases)[DemoScenarioKey]][]).map(
      ([key, c]) => ({
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
      }),
    ),
  );

  protected onScenarioSelect(s: DemoScenario): void {
    this._scenarioKey.set(s.key);
    this.intakeError.set(null);
    this.prefill.set({
      patientId: s.patientId,
      policyNumber: s.policyNumber,
      // `s.format` ya viene en lowercase ('text' | 'pdf'), alineado con
      // ReportFormat del backend — sin necesidad de normalizar acá.
      format: s.format,
      content: s.report,
      procedureSolicitedHint: s.procedureCode === '?' ? undefined : s.procedureCode,
      medicalPdfFile: null,
    });
  }

  protected async onMedicalFileInput(evt: Event): Promise<void> {
    const input = evt.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (!file) return;
    const err = this.validatePdf(file);
    if (err) {
      this.intakeError.set(err);
      return;
    }
    this.intakeError.set(null);
    this.intakeBusy.set('medical');
    try {
      const data = await firstValueFrom(this.extractApi.extractMedicalPdf(file));
      this.applyMedicalExtract(file, data);
      this.lastMedicalName.set(file.name);
    } catch (e: unknown) {
      this.intakeError.set(formatExtractError(e));
    } finally {
      this.intakeBusy.set(null);
    }
  }

  protected async onPolicyFileInput(evt: Event): Promise<void> {
    const input = evt.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (!file) return;
    const err = this.validatePdf(file);
    if (err) {
      this.intakeError.set(err);
      return;
    }
    this.intakeError.set(null);
    this.intakeBusy.set('policy');
    try {
      const data = await firstValueFrom(this.extractApi.extractPolicyPdf(file));
      this.applyPolicyExtract(data);
      this.lastPolicyName.set(file.name);
    } catch (e: unknown) {
      this.intakeError.set(formatExtractError(e));
    } finally {
      this.intakeBusy.set(null);
    }
  }

  private validatePdf(file: File): string | null {
    if (file.type !== 'application/pdf') {
      return 'El archivo debe ser PDF.';
    }
    if (file.size > 10 * 1024 * 1024) {
      return 'El PDF supera 10 MB.';
    }
    return null;
  }

  private applyMedicalExtract(file: File, data: MedicalPdfExtractDto): void {
    const cur = this.prefill();
    this.prefill.set({
      patientId: coalesce(data.patient_id, cur?.patientId),
      policyNumber: coalesce(data.policy_number, cur?.policyNumber),
      format: 'pdf',
      medicalPdfFile: file,
      procedureSolicitedHint: coalesce(data.procedure_code, cur?.procedureSolicitedHint),
      diagnosis: mergeDx(data.diagnosis, data.diagnosis_code, cur?.diagnosis),
      attendingDoctor: coalesce(data.attending_doctor, cur?.attendingDoctor),
      content: coalesce(data.report_text_summary, cur?.content) ?? '',
    });
    this._scenarioKey.set(undefined);
  }

  private applyPolicyExtract(data: PolicyPdfExtractDto): void {
    const cur = this.prefill();
    if (cur) {
      this.prefill.set({
        ...cur,
        patientId: coalesce(data.patient_id, cur.patientId),
        policyNumber: coalesce(data.policy_number, cur.policyNumber),
      });
    } else {
      this.prefill.set({
        patientId: coalesce(data.patient_id, undefined),
        policyNumber: coalesce(data.policy_number, undefined),
      });
    }
    this._scenarioKey.set(undefined);
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

    void this.router.navigate(['/hospital/live-run']).finally(() => {
      this.submitting.set(false);
    });
  }
}

function generateReportId(): string {
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `R-${Date.now()}-${suffix}`;
}

function coalesce(v: string | null | undefined, fallback?: string): string {
  const t = typeof v === 'string' ? v.trim() : '';
  if (t.length > 0) return t;
  return fallback?.trim() ?? '';
}

function mergeDx(
  dx: string | null | undefined,
  code: string | null | undefined,
  prev?: string,
): string {
  const d = typeof dx === 'string' ? dx.trim() : '';
  const c = typeof code === 'string' ? code.trim() : '';
  const parts = [d, c ? `(CIE-10 ${c})` : ''].filter(Boolean);
  if (parts.length > 0) return parts.join(' ');
  return prev?.trim() ?? '';
}

function formatExtractError(err: unknown): string {
  if (err instanceof ApiError) {
    return typeof err.message === 'string' ? err.message : 'Error al extraer el PDF.';
  }
  return 'No se pudo extraer el PDF. Revisá la API o la clave de visión.';
}
