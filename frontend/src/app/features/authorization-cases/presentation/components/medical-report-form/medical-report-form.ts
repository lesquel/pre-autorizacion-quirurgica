import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';

export interface MedicalReportFormPrefill {
  readonly patientId?: string;
  readonly policyNumber?: string;
  readonly format?: 'text' | 'pdf';
  readonly content?: string;
  readonly procedureSolicitedHint?: string;
  readonly diagnosis?: string;
  readonly attendingDoctor?: string;
}

export interface MedicalReportFormSubmit {
  readonly patientId: string;
  readonly policyNumber: string;
  readonly report: {
    readonly format: 'text' | 'pdf';
    readonly content: string;          // For PDF mode this becomes the placeholder string `"[<filename>]"`
    readonly procedureSolicitedHint?: string;
    readonly diagnosis?: string;
    readonly attendingDoctor?: string;
  };
  readonly file?: File;                  // Set only in PDF mode
}

/**
 * MedicalReportForm — formulario para crear un caso de pre-autorización.
 *
 * - Acepta `prefill` para poblar desde un escenario de demo.
 * - Emite `submit` con el shape que la página convierte luego a entidad
 *   `MedicalReport` antes de pasar a la facade.
 *
 * Toda la state es local con signals. `effect()` sincroniza el `prefill`
 * con los signals locales sin perder la edición manual del usuario:
 * cada vez que llega un prefill nuevo (escenario distinto), se sobreescribe.
 */
@Component({
  selector: 'app-medical-report-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form
      class="flex flex-col gap-5 p-5 bg-surface dark:bg-ink border border-line dark:border-ink-3"
      (submit)="onSubmit($event)"
    >
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label class="flex flex-col gap-1.5">
          <span
            class="font-mono text-[10px] uppercase tracking-wider text-ink-3 dark:text-ink-5"
          >
            ID Paciente
          </span>
          <input
            type="text"
            class="px-3 py-2 bg-bg-2 dark:bg-ink-2 border border-line dark:border-ink-3 text-ink dark:text-bg font-mono text-sm focus:outline-none focus:border-info"
            [value]="patientId()"
            (input)="patientId.set($any($event.target).value)"
            placeholder="PAC-00481"
            autocomplete="off"
          />
        </label>

        <label class="flex flex-col gap-1.5">
          <span
            class="font-mono text-[10px] uppercase tracking-wider text-ink-3 dark:text-ink-5"
          >
            Nº Póliza
          </span>
          <input
            type="text"
            class="px-3 py-2 bg-bg-2 dark:bg-ink-2 border border-line dark:border-ink-3 text-ink dark:text-bg font-mono text-sm focus:outline-none focus:border-info"
            [value]="policyNumber()"
            (input)="policyNumber.set($any($event.target).value)"
            placeholder="POL-2024-04812"
            autocomplete="off"
          />
        </label>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <label class="flex flex-col gap-1.5">
          <span
            class="font-mono text-[10px] uppercase tracking-wider text-ink-3 dark:text-ink-5"
          >
            Formato
          </span>
          <select
            class="px-3 py-2 bg-bg-2 dark:bg-ink-2 border border-line dark:border-ink-3 text-ink dark:text-bg font-mono text-sm focus:outline-none focus:border-info"
            [value]="format()"
            (change)="format.set($any($event.target).value)"
          >
            <option value="text">TEXTO</option>
            <option value="pdf">PDF</option>
          </select>
        </label>

        <label class="flex flex-col gap-1.5">
          <span
            class="font-mono text-[10px] uppercase tracking-wider text-ink-3 dark:text-ink-5"
          >
            Hint procedimiento (CIE-10)
          </span>
          <input
            type="text"
            class="px-3 py-2 bg-bg-2 dark:bg-ink-2 border border-line dark:border-ink-3 text-ink dark:text-bg font-mono text-sm focus:outline-none focus:border-info"
            [value]="procedureSolicitedHint()"
            (input)="procedureSolicitedHint.set($any($event.target).value)"
            placeholder="K80.20"
            autocomplete="off"
          />
        </label>

        <label class="flex flex-col gap-1.5">
          <span
            class="font-mono text-[10px] uppercase tracking-wider text-ink-3 dark:text-ink-5"
          >
            Médico tratante
          </span>
          <input
            type="text"
            class="px-3 py-2 bg-bg-2 dark:bg-ink-2 border border-line dark:border-ink-3 text-ink dark:text-bg text-sm focus:outline-none focus:border-info"
            [value]="attendingDoctor()"
            (input)="attendingDoctor.set($any($event.target).value)"
            placeholder="Dr. R. Salgado"
            autocomplete="off"
          />
        </label>
      </div>

      <label class="flex flex-col gap-1.5">
        <span
          class="font-mono text-[10px] uppercase tracking-wider text-ink-3 dark:text-ink-5"
        >
          Diagnóstico
        </span>
        <input
          type="text"
          class="px-3 py-2 bg-bg-2 dark:bg-ink-2 border border-line dark:border-ink-3 text-ink dark:text-bg text-sm focus:outline-none focus:border-info"
          [value]="diagnosis()"
          (input)="diagnosis.set($any($event.target).value)"
          placeholder="Colelitiasis sintomática…"
          autocomplete="off"
        />
      </label>

      @if (format() === 'pdf') {
        <label class="flex flex-col gap-1.5">
          <span class="font-mono text-[10px] uppercase tracking-wider text-ink-3 dark:text-ink-5">
            Archivo PDF (≤ 10 MB)
          </span>
          <input
            type="file"
            accept="application/pdf"
            class="text-sm"
            (change)="onFileChange($event)"
          />
          @if (file()) {
            <span class="text-xs text-ink-3 dark:text-ink-5 mt-1">
              {{ file()!.name }} · {{ formatBytes(file()!.size) }}
            </span>
          }
          @if (fileError()) {
            <span class="text-xs text-error mt-1">{{ fileError() }}</span>
          }
        </label>
      } @else {
        <label class="flex flex-col gap-1.5">
          <span
            class="font-mono text-[10px] uppercase tracking-wider text-ink-3 dark:text-ink-5"
          >
            Informe médico
          </span>
          <textarea
            rows="12"
            class="px-3 py-2 bg-bg-2 dark:bg-ink-2 border border-line dark:border-ink-3 text-ink dark:text-bg font-mono text-xs leading-relaxed focus:outline-none focus:border-info resize-y"
            [value]="content()"
            (input)="content.set($any($event.target).value)"
            placeholder="Pegue o escriba el informe médico aquí…"
          ></textarea>
        </label>
      }

      <div class="flex items-center justify-between gap-3 pt-2">
        <span
          class="font-mono text-[10px] uppercase tracking-wider text-ink-4"
        >
          ≤ 20s · trazabilidad completa · cero auto-rechazo
        </span>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="px-4 py-2 bg-bg-2 dark:bg-ink-2 border border-line dark:border-ink-3 text-ink dark:text-bg font-mono text-xs uppercase tracking-wider hover:bg-bg-3 transition-colors"
            (click)="onReset()"
          >
            Reset
          </button>
          <button
            type="submit"
            class="px-4 py-2 bg-ink dark:bg-bg text-bg dark:text-ink border border-ink dark:border-bg font-mono text-xs uppercase tracking-wider hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            [disabled]="!valid() || submitting()"
          >
            @if (submitting()) {
              Procesando…
            } @else {
              Solicitar pre-autorización →
            }
          </button>
        </div>
      </div>
    </form>
  `,
})
export class MedicalReportForm {
  readonly submitting = input<boolean>(false);
  readonly prefill = input<MedicalReportFormPrefill | undefined>(undefined);
  readonly submit = output<MedicalReportFormSubmit>();

  protected readonly patientId = signal('');
  protected readonly policyNumber = signal('');
  protected readonly format = signal<'text' | 'pdf'>('text');
  protected readonly content = signal('');
  protected readonly procedureSolicitedHint = signal('');
  protected readonly diagnosis = signal('');
  protected readonly attendingDoctor = signal('');
  protected readonly file = signal<File | null>(null);
  protected readonly fileError = signal<string | null>(null);

  protected readonly valid = computed(() => {
    const baseValid =
      this.patientId().trim().length > 0 &&
      this.policyNumber().trim().length > 0;
    if (!baseValid) return false;
    if (this.format() === 'pdf') return this.file() !== null;
    return this.content().trim().length > 0;
  });

  constructor() {
    // Sync prefill → signals locales. Se dispara cada vez que el padre
    // cambia el prefill (ej: usuario elige otro escenario).
    effect(() => {
      const p = this.prefill();
      if (!p) {
        return;
      }
      this.patientId.set(p.patientId ?? '');
      this.policyNumber.set(p.policyNumber ?? '');
      this.format.set(p.format ?? 'text');
      this.content.set(p.content ?? '');
      this.procedureSolicitedHint.set(p.procedureSolicitedHint ?? '');
      this.diagnosis.set(p.diagnosis ?? '');
      this.attendingDoctor.set(p.attendingDoctor ?? '');
    });
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    if (!this.valid() || this.submitting()) {
      return;
    }
    const isPdf = this.format() === 'pdf';
    this.submit.emit({
      patientId: this.patientId().trim(),
      policyNumber: this.policyNumber().trim(),
      report: {
        format: this.format(),
        content: isPdf ? `[${this.file()!.name}]` : this.content(),
        procedureSolicitedHint: this.procedureSolicitedHint().trim() || undefined,
        diagnosis: this.diagnosis().trim() || undefined,
        attendingDoctor: this.attendingDoctor().trim() || undefined,
      },
      file: isPdf ? this.file()! : undefined,
    });
  }

  protected onReset(): void {
    this.patientId.set('');
    this.policyNumber.set('');
    this.format.set('text');
    this.content.set('');
    this.procedureSolicitedHint.set('');
    this.diagnosis.set('');
    this.attendingDoctor.set('');
    this.file.set(null);
    this.fileError.set(null);
  }

  protected onFileChange(evt: Event): void {
    const input = evt.target as HTMLInputElement;
    const f = input.files?.[0] ?? null;
    if (!f) {
      this.file.set(null);
      this.fileError.set(null);
      return;
    }
    if (f.type !== 'application/pdf') {
      this.file.set(null);
      this.fileError.set('El archivo debe ser application/pdf.');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      this.file.set(null);
      this.fileError.set('El archivo supera 10 MB.');
      return;
    }
    this.file.set(f);
    this.fileError.set(null);
  }

  protected formatBytes(b: number): string {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
    return `${(b / 1024 / 1024).toFixed(1)} MB`;
  }
}
