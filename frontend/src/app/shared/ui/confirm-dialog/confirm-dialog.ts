import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { ConfirmDialogService } from './confirm-dialog.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (active(); as req) {
      <div
        role="dialog"
        aria-modal="true"
        [attr.aria-labelledby]="'confirm-title'"
        class="fixed inset-0 z-[200] flex items-center justify-center p-4"
      >
        <button
          type="button"
          class="absolute inset-0 bg-ink/40 dark:bg-ink/60"
          aria-label="Cancelar"
          (click)="svc.cancel()"
        ></button>
        <div
          class="relative w-full max-w-[420px] bg-surface dark:bg-ink-2 border border-line dark:border-ink-3 shadow-[0_24px_48px_-12px_rgba(20,19,15,0.18)] dark:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.55)] p-6 flex flex-col gap-4"
        >
          <h2
            id="confirm-title"
            class="font-serif text-xl font-semibold text-ink dark:text-bg m-0 tracking-tight"
          >
            {{ req.title }}
          </h2>
          <p class="text-sm text-ink-3 dark:text-ink-5 m-0 leading-snug">{{ req.message }}</p>
          <div class="flex justify-end gap-2 pt-2">
            <button
              type="button"
              class="px-4 py-2 border border-line dark:border-ink-3 text-ink dark:text-bg font-mono text-xs uppercase tracking-wider hover:bg-bg-2 dark:hover:bg-ink transition-colors"
              (click)="svc.cancel()"
            >
              {{ req.cancelLabel ?? 'Cancelar' }}
            </button>
            <button
              type="button"
              [class]="confirmClass()"
              (click)="svc.accept()"
            >
              {{ req.confirmLabel ?? 'Confirmar' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ConfirmDialog {
  protected readonly svc = inject(ConfirmDialogService);
  protected readonly active = this.svc.active;
  protected readonly confirmClass = computed(() => {
    const req = this.active();
    const base = 'px-4 py-2 font-mono text-xs uppercase tracking-wider transition-opacity hover:opacity-90';
    if (req?.tone === 'danger') {
      return `${base} bg-err text-bg border border-err`;
    }
    return `${base} bg-ink dark:bg-bg text-bg dark:text-ink border border-ink dark:border-bg`;
  });
}
