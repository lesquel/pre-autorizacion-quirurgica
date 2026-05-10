import { Injectable, signal } from '@angular/core';

export type ToastTone = 'success' | 'error' | 'info' | 'warn';

export interface Toast {
  readonly id: number;
  readonly message: string;
  readonly tone: ToastTone;
}

const DEFAULT_DURATION_MS = 4000;

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  private readonly _toasts = signal<readonly Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  success(message: string, durationMs = DEFAULT_DURATION_MS): void {
    this.push({ tone: 'success', message }, durationMs);
  }

  error(message: string, durationMs = DEFAULT_DURATION_MS): void {
    this.push({ tone: 'error', message }, durationMs);
  }

  info(message: string, durationMs = DEFAULT_DURATION_MS): void {
    this.push({ tone: 'info', message }, durationMs);
  }

  warn(message: string, durationMs = DEFAULT_DURATION_MS): void {
    this.push({ tone: 'warn', message }, durationMs);
  }

  dismiss(id: number): void {
    this._toasts.update((list) => list.filter((t) => t.id !== id));
  }

  private push(meta: Omit<Toast, 'id'>, durationMs: number): void {
    const id = this.nextId++;
    this._toasts.update((list) => [...list, { id, ...meta }]);
    if (durationMs > 0) {
      setTimeout(() => this.dismiss(id), durationMs);
    }
  }
}
