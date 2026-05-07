import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  output,
  signal,
} from '@angular/core';

import type { Policy } from '../../../../domain/entities';

interface PolicyFormState {
  number: string;
  patientId: string;
  plan: string;
  insurerId: string;
  startDate: string;
  endDate: string;
  status: Policy['status'];
}

const EMPTY: PolicyFormState = {
  number: '',
  patientId: '',
  plan: '',
  insurerId: 'INS-ANDINA',
  startDate: '',
  endDate: '',
  status: 'ACTIVE',
};

/**
 * PolicyFormComponent — slide-over form for creating or editing a Policy.
 *
 * - When `initial` is null, it's a create form (number is editable).
 * - When `initial` is a Policy, the number field is read-only (number is the
 *   primary key on the backend; changing it would require delete+create).
 *
 * Emits `submitForm` with a fully-shaped Policy on save, or `cancel` to close.
 */
@Component({
  selector: 'app-policy-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form
      class="flex flex-col gap-3 p-5 bg-surface dark:bg-ink border border-line dark:border-ink-3 max-w-md"
      (submit)="onSubmit($event)"
    >
      <h2 class="text-lg font-semibold text-ink dark:text-bg">
        {{ initial() ? 'Editar póliza' : 'Nueva póliza' }}
      </h2>

      <label class="flex flex-col gap-1">
        <span class="font-mono text-[10px] uppercase tracking-wider text-ink-3 dark:text-ink-5">Número</span>
        <input
          type="text"
          class="px-3 py-2 bg-bg-2 dark:bg-ink-2 border border-line dark:border-ink-3 text-ink dark:text-bg font-mono text-sm focus:outline-none focus:border-info"
          [value]="state().number"
          (input)="patch({ number: $any($event.target).value })"
          [readonly]="!!initial()"
          required
        />
      </label>

      <label class="flex flex-col gap-1">
        <span class="font-mono text-[10px] uppercase tracking-wider text-ink-3 dark:text-ink-5">Patient ID</span>
        <input
          type="text"
          class="px-3 py-2 bg-bg-2 dark:bg-ink-2 border border-line dark:border-ink-3 text-ink dark:text-bg font-mono text-sm focus:outline-none focus:border-info"
          [value]="state().patientId"
          (input)="patch({ patientId: $any($event.target).value })"
          required
        />
      </label>

      <label class="flex flex-col gap-1">
        <span class="font-mono text-[10px] uppercase tracking-wider text-ink-3 dark:text-ink-5">Plan</span>
        <input
          type="text"
          class="px-3 py-2 bg-bg-2 dark:bg-ink-2 border border-line dark:border-ink-3 text-ink dark:text-bg text-sm focus:outline-none focus:border-info"
          [value]="state().plan"
          (input)="patch({ plan: $any($event.target).value })"
          required
        />
      </label>

      <label class="flex flex-col gap-1">
        <span class="font-mono text-[10px] uppercase tracking-wider text-ink-3 dark:text-ink-5">Insurer ID</span>
        <input
          type="text"
          class="px-3 py-2 bg-bg-2 dark:bg-ink-2 border border-line dark:border-ink-3 text-ink dark:text-bg font-mono text-sm focus:outline-none focus:border-info"
          [value]="state().insurerId"
          (input)="patch({ insurerId: $any($event.target).value })"
          required
        />
      </label>

      <div class="grid grid-cols-2 gap-3">
        <label class="flex flex-col gap-1">
          <span class="font-mono text-[10px] uppercase tracking-wider text-ink-3 dark:text-ink-5">Inicio</span>
          <input
            type="date"
            class="px-3 py-2 bg-bg-2 dark:bg-ink-2 border border-line dark:border-ink-3 text-ink dark:text-bg font-mono text-sm focus:outline-none focus:border-info"
            [value]="state().startDate"
            (input)="patch({ startDate: $any($event.target).value })"
            required
          />
        </label>

        <label class="flex flex-col gap-1">
          <span class="font-mono text-[10px] uppercase tracking-wider text-ink-3 dark:text-ink-5">Fin</span>
          <input
            type="date"
            class="px-3 py-2 bg-bg-2 dark:bg-ink-2 border border-line dark:border-ink-3 text-ink dark:text-bg font-mono text-sm focus:outline-none focus:border-info"
            [value]="state().endDate"
            (input)="patch({ endDate: $any($event.target).value })"
            required
          />
        </label>
      </div>

      <label class="flex flex-col gap-1">
        <span class="font-mono text-[10px] uppercase tracking-wider text-ink-3 dark:text-ink-5">Estado</span>
        <select
          class="px-3 py-2 bg-bg-2 dark:bg-ink-2 border border-line dark:border-ink-3 text-ink dark:text-bg text-sm focus:outline-none focus:border-info"
          [value]="state().status"
          (change)="patch({ status: $any($event.target).value })"
        >
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
          <option value="SUSPENDED">SUSPENDED</option>
        </select>
      </label>

      @if (error()) {
        <p class="text-error text-sm">{{ error() }}</p>
      }

      <div class="flex gap-2 justify-end pt-2">
        <button
          type="button"
          class="px-4 py-2 bg-bg-2 dark:bg-ink-2 border border-line dark:border-ink-3 text-ink dark:text-bg font-mono text-xs uppercase tracking-wider hover:bg-bg-3 transition-colors"
          (click)="cancel.emit()"
        >
          Cancelar
        </button>
        <button
          type="submit"
          class="px-4 py-2 bg-ink dark:bg-bg text-bg dark:text-ink border border-ink dark:border-bg font-mono text-xs uppercase tracking-wider hover:opacity-90 transition-opacity disabled:opacity-50"
          [disabled]="saving()"
        >
          {{ saving() ? 'Guardando…' : 'Guardar' }}
        </button>
      </div>
    </form>
  `,
})
export class PolicyFormComponent {
  readonly initial = input<Policy | null>(null);
  readonly saving = input<boolean>(false);
  readonly error = input<string | null>(null);
  readonly submitForm = output<Policy>();
  readonly cancel = output<void>();

  protected readonly state = signal<PolicyFormState>({ ...EMPTY });

  constructor() {
    effect(() => {
      const p = this.initial();
      if (p) {
        this.state.set({ ...p });
      } else {
        this.state.set({ ...EMPTY });
      }
    });
  }

  protected patch(partial: Partial<PolicyFormState>): void {
    this.state.update((s) => ({ ...s, ...partial }));
  }

  protected onSubmit(evt: Event): void {
    evt.preventDefault();
    const s = this.state();
    this.submitForm.emit({
      number: s.number.trim(),
      patientId: s.patientId.trim(),
      plan: s.plan.trim(),
      insurerId: s.insurerId.trim(),
      startDate: s.startDate,
      endDate: s.endDate,
      status: s.status,
    });
  }
}
