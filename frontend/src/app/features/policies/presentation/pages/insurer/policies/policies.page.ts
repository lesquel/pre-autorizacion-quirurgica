import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';

import { PageHeader } from '../../../../../../core/components';
import { ConfirmDialogService, Pill, ToastService } from '../../../../../../shared/ui';
import type { Insurer, Policy } from '../../../../domain/entities';
import { PoliciesFacade } from '../../../../application/facades/policies.facade';
import { PolicyFormComponent } from './policy-form.component';

/**
 * Row del listado — pre-resolvemos `insurerName` para que el template no haga
 * lookups por fila (el OnPush + computed garantiza que el mapeo se hace una sola
 * vez por cambio en `policies()`/`insurers()`).
 */
interface PolicyRow {
  readonly policy: Policy;
  readonly insurerName: string;
}

@Component({
  selector: 'app-insurer-policies-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeader, Pill, PolicyFormComponent],
  template: `
    <app-page-header
      title="Pólizas"
      subtitle="Gestión de pólizas"
      [breadcrumbs]="['Aseguradora', 'Pólizas']"
    />

    <section class="px-0 py-4 lg:px-7 lg:py-6 flex flex-col gap-4">
      <div class="flex justify-end">
        <button
          type="button"
          class="px-4 py-2 bg-ink dark:bg-bg text-bg dark:text-ink font-mono text-xs uppercase tracking-wider"
          (click)="openCreate()"
        >
          + Nueva póliza
        </button>
      </div>

      <div class="bg-surface border border-line overflow-x-auto">
        <table class="w-full border-collapse text-[13px]">
          <thead>
            <tr class="border-b border-line bg-bg-2">
              <th class="text-left font-mono text-[11px] uppercase tracking-wider text-ink-3 px-3 py-2">
                Número
              </th>
              <th class="text-left font-mono text-[11px] uppercase tracking-wider text-ink-3 px-3 py-2">
                Paciente
              </th>
              <th class="text-left font-mono text-[11px] uppercase tracking-wider text-ink-3 px-3 py-2">
                Plan
              </th>
              <th class="text-left font-mono text-[11px] uppercase tracking-wider text-ink-3 px-3 py-2">
                Aseguradora
              </th>
              <th class="text-left font-mono text-[11px] uppercase tracking-wider text-ink-3 px-3 py-2">
                Inicio
              </th>
              <th class="text-left font-mono text-[11px] uppercase tracking-wider text-ink-3 px-3 py-2">
                Fin
              </th>
              <th class="text-left font-mono text-[11px] uppercase tracking-wider text-ink-3 px-3 py-2">
                Estado
              </th>
              <th class="text-left font-mono text-[11px] uppercase tracking-wider text-ink-3 px-3 py-2">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.policy.number) {
              <tr class="border-b border-line last:border-b-0">
                <td class="font-mono text-[12px] px-3 py-2.5">{{ row.policy.number }}</td>
                <td class="px-3 py-2.5 text-ink-3">{{ row.policy.patientId }}</td>
                <td class="px-3 py-2.5">{{ row.policy.plan }}</td>
                <td class="px-3 py-2.5">{{ row.insurerName }}</td>
                <td class="font-mono text-[12px] text-ink-3 px-3 py-2.5">{{ row.policy.startDate }}</td>
                <td class="font-mono text-[12px] text-ink-3 px-3 py-2.5">{{ row.policy.endDate }}</td>
                <td class="px-3 py-2.5">
                  <app-pill [text]="row.policy.status" [tone]="toneFor(row.policy.status)" />
                </td>
                <td class="px-3 py-2.5">
                  <div class="flex gap-2">
                    <button
                      type="button"
                      class="text-xs font-mono uppercase text-info hover:underline"
                      (click)="openEdit(row.policy)"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      class="text-xs font-mono uppercase text-error hover:underline"
                      (click)="onDelete(row.policy)"
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="8" class="px-3 py-6 text-center text-ink-4 text-sm">
                  No hay pólizas cargadas.
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      @if (editing() !== undefined) {
        <aside class="fixed inset-y-0 right-0 w-[450px] z-50 bg-surface dark:bg-ink shadow-2xl border-l border-line dark:border-ink-3 overflow-y-auto">
          <app-policy-form
            [initial]="editing() ?? null"
            [saving]="saving()"
            [error]="formError()"
            (submitForm)="onSave($event)"
            (cancel)="close()"
          />
        </aside>
      }
    </section>
  `,
})
export class InsurerPoliciesPage {
  private readonly facade = inject(PoliciesFacade);
  private readonly toasts = inject(ToastService);
  private readonly confirm = inject(ConfirmDialogService);

  /**
   * Pre-resolvemos un mapa `insurerId → name` para que el join sea O(1) por
   * fila. Si la lista de aseguradoras o pólizas cambia, el computed se
   * recalcula solo.
   */
  private readonly insurerMap = computed<ReadonlyMap<string, Insurer>>(() => {
    const map = new Map<string, Insurer>();
    for (const i of this.facade.insurers()) {
      map.set(i.id, i);
    }
    return map;
  });

  protected readonly rows = computed<readonly PolicyRow[]>(() => {
    const insurers = this.insurerMap();
    return this.facade.policies().map((policy) => ({
      policy,
      insurerName: insurers.get(policy.insurerId)?.name ?? policy.insurerId,
    }));
  });

  // ---------------------------------------------------------------------------
  // Slide-over state — three-state semantics:
  //   undefined = panel closed
  //   null      = creating a new policy
  //   Policy    = editing an existing policy (state pre-loaded)
  // ---------------------------------------------------------------------------

  protected readonly editing = signal<Policy | null | undefined>(undefined);
  protected readonly saving = signal<boolean>(false);
  protected readonly formError = signal<string | null>(null);

  protected openCreate(): void {
    this.editing.set(null);
    this.formError.set(null);
  }

  protected openEdit(p: Policy): void {
    this.editing.set({ ...p });
    this.formError.set(null);
  }

  protected close(): void {
    this.editing.set(undefined);
    this.formError.set(null);
  }

  protected async onSave(p: Policy): Promise<void> {
    this.saving.set(true);
    this.formError.set(null);
    try {
      const isEdit = this.editing() !== null;
      if (isEdit) {
        await this.facade.updatePolicy(p);
        this.toasts.success(`Póliza ${p.number} actualizada.`);
      } else {
        await this.facade.createPolicy(p);
        this.toasts.success(`Póliza ${p.number} creada.`);
      }
      this.close();
    } catch (err) {
      this.formError.set(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      this.saving.set(false);
    }
  }

  protected async onDelete(p: Policy): Promise<void> {
    const accepted = await this.confirm.ask({
      title: `Eliminar póliza ${p.number}?`,
      message: `Se eliminará la póliza del plan ${p.plan}. Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      tone: 'danger',
    });
    if (!accepted) {
      return;
    }
    try {
      await this.facade.deletePolicy(p.number);
      this.toasts.success(`Póliza ${p.number} eliminada.`);
    } catch (err) {
      this.toasts.error(err instanceof Error ? err.message : 'No se pudo eliminar la póliza.');
    }
  }

  /**
   * Tono del Pill según estado canónico de la póliza. Sólo `ACTIVE` aparece
   * en el SEED del MVP, pero modelamos los tres porque el dominio los expone.
   */
  protected toneFor(status: Policy['status']): 'ok' | 'warn' | 'err' {
    switch (status) {
      case 'ACTIVE':
        return 'ok';
      case 'SUSPENDED':
        return 'warn';
      case 'INACTIVE':
        return 'err';
    }
  }
}
