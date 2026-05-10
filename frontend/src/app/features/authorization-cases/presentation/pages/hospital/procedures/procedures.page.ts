import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';

import { PageHeader } from '../../../../../../core/components/page-header/page-header';
import type { Procedure } from '../../../../../../shared/domain/entities';
import { HttpProcedureRepository } from '../../../../../../shared/infrastructure/repos/http-procedure.repository';
import { ConfirmDialogService, EmptyState, Spinner, ToastService } from '../../../../../../shared/ui';
import { ProcedureFormComponent } from './procedure-form.component';

/**
 * HospitalProceduresPage — catálogo CIE-10 con CRUD.
 *
 * Render: tabla con código, nombre, categoría, carencia y acciones por fila.
 * Las mutaciones (crear/editar/borrar) abren un slide-over con formulario y
 * dan feedback vía toast service.
 */
@Component({
  selector: 'app-hospital-procedures-page',
  standalone: true,
  imports: [PageHeader, ProcedureFormComponent, EmptyState, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header
      title="Catálogo CIE-10"
      subtitle="Procedimientos quirúrgicos cubiertos. La carencia típica es referencial — la cobertura efectiva depende de la póliza."
      [breadcrumbs]="['Hospital', 'Procedimientos']"
    />

    <section class="px-0 py-4 lg:px-7 lg:py-6 flex flex-col gap-4">
      <div class="flex justify-end">
        <button
          type="button"
          class="px-4 py-2 bg-ink dark:bg-bg text-bg dark:text-ink font-mono text-xs uppercase tracking-wider hover:opacity-90 transition-opacity"
          (click)="openCreate()"
        >
          + Nuevo procedimiento
        </button>
      </div>

      <div
        class="bg-surface dark:bg-ink border border-line dark:border-ink-3 overflow-x-auto"
      >
        @if (loading()) {
          <div class="flex justify-center items-center py-12 text-ink-3 dark:text-ink-5">
            <app-spinner size="lg" />
          </div>
        } @else if (procedures().length === 0) {
          <app-empty-state
            title="Sin procedimientos cargados"
            message="Empezá agregando el primer procedimiento al catálogo CIE-10."
            ctaLabel="+ Crear procedimiento"
            (action)="openCreate()"
          />
        } @else {
          <table class="w-full text-left">
            <thead>
              <tr
                class="text-[11px] font-mono uppercase tracking-wider text-ink-4 border-b border-line dark:border-ink-3"
              >
                <th class="px-4 py-2.5 font-normal">Código</th>
                <th class="px-4 py-2.5 font-normal">Nombre</th>
                <th class="px-4 py-2.5 font-normal">Categoría</th>
                <th class="px-4 py-2.5 font-normal">Carencia típica</th>
                <th class="px-4 py-2.5 font-normal text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (p of procedures(); track p.code) {
                <tr class="border-b last:border-b-0 border-line dark:border-ink-3">
                  <td class="px-4 py-3 font-mono text-sm text-ink dark:text-bg">
                    {{ p.code }}
                  </td>
                  <td class="px-4 py-3 text-sm text-ink dark:text-bg">
                    {{ p.name }}
                  </td>
                  <td class="px-4 py-3 text-sm text-ink-3 dark:text-ink-5">
                    {{ p.category ?? '—' }}
                  </td>
                  <td
                    class="px-4 py-3 font-mono text-[11px] text-ink-3 dark:text-ink-5 tabular-nums"
                  >
                    {{ formatWaiting(p.waitingDaysTypical ?? null) }}
                  </td>
                  <td class="px-4 py-3 text-right">
                    <div class="inline-flex gap-3">
                      <button
                        type="button"
                        class="font-mono text-[11px] uppercase tracking-wider text-info hover:underline"
                        (click)="openEdit(p)"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        class="font-mono text-[11px] uppercase tracking-wider text-err hover:underline"
                        (click)="onDelete(p)"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
      </div>

      @if (editing() !== undefined) {
        <aside
          class="fixed inset-y-0 right-0 w-full sm:w-[450px] z-50 bg-surface dark:bg-ink shadow-2xl border-l border-line dark:border-ink-3 overflow-y-auto"
          aria-label="Formulario de procedimiento"
        >
          <app-procedure-form
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
export class HospitalProceduresPage {
  private readonly repo = inject(HttpProcedureRepository);
  private readonly toasts = inject(ToastService);
  private readonly confirm = inject(ConfirmDialogService);

  protected readonly procedures = this.repo.procedures;
  protected readonly loading = signal<boolean>(false);

  // Slide-over: undefined = closed, null = create, Procedure = edit.
  protected readonly editing = signal<Procedure | null | undefined>(undefined);
  protected readonly saving = signal<boolean>(false);
  protected readonly formError = signal<string | null>(null);

  protected readonly hasData = computed<boolean>(() => this.procedures().length > 0);

  constructor() {
    void this.refresh();
  }

  protected async refresh(): Promise<void> {
    if (this.hasData()) {
      return;
    }
    this.loading.set(true);
    try {
      await this.repo.list();
    } catch (err) {
      this.toasts.error(this.formatError(err, 'No se pudo cargar el catálogo.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.formError.set(null);
  }

  protected openEdit(p: Procedure): void {
    this.editing.set({ ...p });
    this.formError.set(null);
  }

  protected close(): void {
    this.editing.set(undefined);
    this.formError.set(null);
  }

  protected async onSave(p: Procedure): Promise<void> {
    this.saving.set(true);
    this.formError.set(null);
    try {
      const isEdit = this.editing() !== null;
      if (isEdit) {
        await this.repo.update(p);
        this.toasts.success(`Procedimiento ${p.code} actualizado.`);
      } else {
        await this.repo.create(p);
        this.toasts.success(`Procedimiento ${p.code} creado.`);
      }
      this.close();
    } catch (err) {
      const msg = this.formatError(err, 'No se pudo guardar el procedimiento.');
      this.formError.set(msg);
    } finally {
      this.saving.set(false);
    }
  }

  protected async onDelete(p: Procedure): Promise<void> {
    const accepted = await this.confirm.ask({
      title: `Eliminar ${p.code}?`,
      message: `Se eliminará "${p.name}" del catálogo. Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      tone: 'danger',
    });
    if (!accepted) {
      return;
    }
    try {
      await this.repo.delete(p.code);
      this.toasts.success(`Procedimiento ${p.code} eliminado.`);
    } catch (err) {
      this.toasts.error(this.formatError(err, 'No se pudo eliminar.'));
    }
  }

  protected formatWaiting(days: number | null): string {
    if (days === null) {
      return '—';
    }
    if (days === 0) {
      return 'Sin carencia (urgencia)';
    }
    if (days < 365) {
      return `${days} días`;
    }
    if (days === 365) {
      return '1 año';
    }
    const years = Math.floor(days / 365);
    return `${years} años`;
  }

  private formatError(err: unknown, fallback: string): string {
    if (err instanceof Error && err.message) {
      return err.message;
    }
    return fallback;
  }
}
