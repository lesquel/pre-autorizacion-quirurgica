import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ToastService, type ToastTone } from './toast.service';

const TONE_CLASSES: Record<ToastTone, string> = {
  success: 'border-ok/40 bg-ok-bg text-ok',
  error: 'border-err/40 bg-err-bg text-err',
  warn: 'border-warn/40 bg-warn-bg text-warn',
  info: 'border-line bg-surface text-ink dark:border-ink-3 dark:bg-ink-2 dark:text-bg',
};

const TONE_PREFIX: Record<ToastTone, string> = {
  success: '✓',
  error: '!',
  warn: '!',
  info: 'i',
};

@Component({
  selector: 'app-toast-container',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-[360px] pointer-events-none"
      aria-live="polite"
      aria-atomic="true"
    >
      @for (t of toasts(); track t.id) {
        <div
          role="status"
          class="pointer-events-auto flex items-start gap-2 px-3 py-2.5 border text-sm shadow-md"
          [class]="toneClass(t.tone)"
        >
          <span class="shrink-0 font-mono text-xs leading-5 mt-px" aria-hidden="true">
            {{ tonePrefix(t.tone) }}
          </span>
          <span class="leading-snug flex-1">{{ t.message }}</span>
          <button
            type="button"
            class="shrink-0 font-mono text-[11px] uppercase tracking-wider opacity-60 hover:opacity-100 transition-opacity"
            (click)="toasts$.dismiss(t.id)"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastContainer {
  protected readonly toasts$ = inject(ToastService);
  protected readonly toasts = this.toasts$.toasts;

  protected toneClass(tone: ToastTone): string {
    return TONE_CLASSES[tone];
  }

  protected tonePrefix(tone: ToastTone): string {
    return TONE_PREFIX[tone];
  }
}
