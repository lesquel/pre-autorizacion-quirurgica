import { Injectable, signal } from '@angular/core';

export type ConfirmTone = 'default' | 'danger';

export interface ConfirmRequest {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly tone?: ConfirmTone;
}

interface ActiveRequest extends ConfirmRequest {
  readonly resolve: (accepted: boolean) => void;
}

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private readonly _active = signal<ActiveRequest | null>(null);
  readonly active = this._active.asReadonly();

  ask(request: ConfirmRequest): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this._active.set({ ...request, resolve });
    });
  }

  accept(): void {
    const req = this._active();
    if (req !== null) {
      this._active.set(null);
      req.resolve(true);
    }
  }

  cancel(): void {
    const req = this._active();
    if (req !== null) {
      this._active.set(null);
      req.resolve(false);
    }
  }
}
