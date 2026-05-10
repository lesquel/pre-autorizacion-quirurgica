import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import type { Procedure } from '../../../../../../shared/domain/entities';
import { Spinner } from '../../../../../../shared/ui';

@Component({
  selector: 'app-procedure-form',
  standalone: true,
  imports: [FormsModule, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form
      class="flex flex-col gap-5 p-6"
      (ngSubmit)="onSubmit()"
      novalidate
    >
      <header class="flex items-start justify-between gap-4">
        <div class="flex flex-col gap-1">
          <h2 class="font-serif text-xl font-semibold text-ink dark:text-bg m-0">
            {{ isEdit() ? 'Editar procedimiento' : 'Nuevo procedimiento' }}
          </h2>
          <p class="text-sm text-ink-3 dark:text-ink-5 m-0">
            Catálogo CIE-10. La carencia típica es referencial.
          </p>
        </div>
        <button
          type="button"
          class="font-mono text-xs uppercase text-ink-3 hover:text-ink dark:hover:text-bg"
          (click)="cancel.emit()"
          aria-label="Cerrar"
        >
          Cerrar
        </button>
      </header>

      <div class="flex flex-col gap-1.5">
        <label
          for="proc-code"
          class="font-mono text-[10px] uppercase tracking-wider text-ink-3 dark:text-ink-5"
        >
          Código CIE-10
        </label>
        <input
          id="proc-code"
          name="code"
          type="text"
          [ngModel]="code()"
          (ngModelChange)="code.set($event)"
          [disabled]="isEdit()"
          required
          placeholder="K80.20"
          autocomplete="off"
          spellcheck="false"
          class="w-full px-3 py-2.5 bg-bg-2 dark:bg-ink border border-line dark:border-ink-3 text-ink dark:text-bg text-sm font-mono placeholder:text-ink-4 dark:placeholder:text-ink-5 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors disabled:opacity-50"
        />
        @if (isEdit()) {
          <span class="font-mono text-[10px] text-ink-4">El código no se puede modificar.</span>
        }
      </div>

      <div class="flex flex-col gap-1.5">
        <label
          for="proc-name"
          class="font-mono text-[10px] uppercase tracking-wider text-ink-3 dark:text-ink-5"
        >
          Nombre
        </label>
        <input
          id="proc-name"
          name="name"
          type="text"
          [ngModel]="name()"
          (ngModelChange)="name.set($event)"
          required
          placeholder="Colecistectomía laparoscópica"
          class="w-full px-3 py-2.5 bg-bg-2 dark:bg-ink border border-line dark:border-ink-3 text-ink dark:text-bg text-sm font-sans placeholder:text-ink-4 dark:placeholder:text-ink-5 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors"
        />
      </div>

      <div class="flex flex-col gap-1.5">
        <label
          for="proc-category"
          class="font-mono text-[10px] uppercase tracking-wider text-ink-3 dark:text-ink-5"
        >
          Categoría
        </label>
        <input
          id="proc-category"
          name="category"
          type="text"
          [ngModel]="category()"
          (ngModelChange)="category.set($event)"
          placeholder="Cirugía general"
          class="w-full px-3 py-2.5 bg-bg-2 dark:bg-ink border border-line dark:border-ink-3 text-ink dark:text-bg text-sm font-sans placeholder:text-ink-4 dark:placeholder:text-ink-5 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors"
        />
      </div>

      <div class="flex flex-col gap-1.5">
        <label
          for="proc-waiting"
          class="font-mono text-[10px] uppercase tracking-wider text-ink-3 dark:text-ink-5"
        >
          Carencia típica (días)
        </label>
        <input
          id="proc-waiting"
          name="waitingDaysTypical"
          type="number"
          [ngModel]="waitingDaysTypical()"
          (ngModelChange)="waitingDaysTypical.set($event)"
          min="0"
          placeholder="90"
          class="w-full px-3 py-2.5 bg-bg-2 dark:bg-ink border border-line dark:border-ink-3 text-ink dark:text-bg text-sm font-mono placeholder:text-ink-4 dark:placeholder:text-ink-5 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors"
        />
        <span class="font-mono text-[10px] text-ink-4">
          Dejá vacío si no aplica. 0 = sin carencia (urgencia).
        </span>
      </div>

      @if (error()) {
        <div
          role="alert"
          class="flex gap-2 items-start px-3 py-2.5 border border-err/35 bg-err-bg text-err text-sm"
        >
          <span class="shrink-0 font-mono text-xs leading-5" aria-hidden="true">!</span>
          <span class="leading-snug">{{ error() }}</span>
        </div>
      }

      <div class="flex gap-2 justify-end pt-2">
        <button
          type="button"
          class="px-4 py-2 border border-line dark:border-ink-3 text-ink dark:text-bg font-mono text-xs uppercase tracking-wider hover:bg-bg-2 dark:hover:bg-ink-2 transition-colors"
          (click)="cancel.emit()"
          [disabled]="saving()"
        >
          Cancelar
        </button>
        <button
          type="submit"
          class="inline-flex items-center gap-2 px-4 py-2 bg-ink dark:bg-bg text-bg dark:text-ink font-mono text-xs uppercase tracking-wider hover:opacity-90 transition-opacity disabled:opacity-45 disabled:cursor-not-allowed"
          [disabled]="!isValid() || saving()"
        >
          @if (saving()) {
            <app-spinner size="sm" />
          }
          {{ saving() ? 'Guardando…' : isEdit() ? 'Guardar' : 'Crear' }}
        </button>
      </div>
    </form>
  `,
})
export class ProcedureFormComponent implements OnInit {
  readonly initial = input<Procedure | null>(null);
  readonly saving = input<boolean>(false);
  readonly error = input<string | null>(null);
  readonly submitForm = output<Procedure>();
  readonly cancel = output<void>();

  protected readonly code = signal<string>('');
  protected readonly name = signal<string>('');
  protected readonly category = signal<string>('');
  protected readonly waitingDaysTypical = signal<number | null>(null);

  protected readonly isEdit = computed<boolean>(() => this.initial() !== null);
  protected readonly isValid = computed<boolean>(
    () => this.code().trim().length > 0 && this.name().trim().length > 0,
  );

  ngOnInit(): void {
    const src = this.initial();
    if (src === null) {
      return;
    }
    this.code.set(src.code);
    this.name.set(src.name);
    this.category.set(src.category ?? '');
    this.waitingDaysTypical.set(src.waitingDaysTypical ?? null);
  }

  protected onSubmit(): void {
    if (!this.isValid()) {
      return;
    }
    const out: Procedure = {
      code: this.code().trim(),
      name: this.name().trim(),
      category: this.category().trim() || undefined,
      waitingDaysTypical: this.waitingDaysTypical() ?? undefined,
    };
    this.submitForm.emit(out);
  }
}
