import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthFacade } from '../../../application/facades/auth.facade';
import { ApiError } from '../../../../../shared/api/errors/api-error';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [FormsModule],
  template: `
    <main
      class="min-h-screen flex items-center justify-center bg-bg dark:bg-ink p-6 text-ink dark:text-bg"
    >
      <div class="w-full max-w-[420px] flex flex-col gap-8">
        <div class="text-center">
          <div
            class="inline-grid place-items-center w-9 h-9 mx-auto mb-3 bg-ink dark:bg-bg text-bg dark:text-ink"
            aria-hidden="true"
          >
            <span class="block w-2 h-2 bg-accent"></span>
          </div>
          <p class="font-mono text-[11px] uppercase tracking-wider text-ink-3 dark:text-ink-5 m-0">
            Pre-autorización quirúrgica
          </p>
        </div>

        <form
          (ngSubmit)="submit()"
          class="flex flex-col gap-6 p-7 bg-surface dark:bg-ink-2 border border-line dark:border-ink-3 shadow-[0_24px_48px_-12px_rgba(20,19,15,0.12)] dark:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.45)]"
          novalidate
        >
          <div class="flex flex-col gap-1">
            <h1 class="font-serif text-2xl font-semibold text-ink dark:text-bg m-0 tracking-tight">
              Iniciar sesión
            </h1>
            <p class="text-sm text-ink-3 dark:text-ink-5 m-0">
              Entrá con una cuenta demo en un clic o completá el formulario abajo.
            </p>
          </div>

          <div class="flex flex-col gap-2">
            <span class="font-mono text-[10px] uppercase tracking-wider text-ink-4 dark:text-ink-5">
              Acceso demo (un clic)
            </span>
            <div class="flex flex-col gap-2">
              @for (d of demos; track d.email) {
                <button
                  type="button"
                  (click)="loginWithDemo(d.email, d.password)"
                  [disabled]="loading()"
                  class="group flex flex-col items-start gap-0.5 w-full px-3 py-2.5 text-left bg-bg-2 dark:bg-ink border border-line dark:border-ink-3 hover:border-accent hover:bg-accent-soft/50 dark:hover:bg-ink-2 transition-colors disabled:opacity-45 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface dark:focus-visible:ring-offset-ink-2"
                >
                  <span class="text-sm font-medium text-ink dark:text-bg">{{ d.label }}</span>
                  <span class="font-mono text-[11px] text-ink-3 dark:text-ink-5 tabular-nums">
                    {{ d.email }}
                  </span>
                </button>
              }
            </div>
          </div>

          <p
            class="font-mono text-[10px] uppercase tracking-wider text-ink-4 dark:text-ink-5 m-0 pt-1 border-t border-line dark:border-ink-3"
          >
            O manualmente
          </p>

          <div class="flex flex-col gap-5">
            <div class="flex flex-col gap-1.5">
              <label
                for="login-email"
                class="font-mono text-[10px] uppercase tracking-wider text-ink-3 dark:text-ink-5"
              >
                Email
              </label>
              <input
                id="login-email"
                type="email"
                name="email"
                [(ngModel)]="email"
                autocomplete="email"
                autocapitalize="none"
                spellcheck="false"
                placeholder="nombre@ejemplo.com"
                class="w-full px-3 py-2.5 bg-bg-2 dark:bg-ink border border-line dark:border-ink-3 text-ink dark:text-bg text-sm font-sans placeholder:text-ink-4 dark:placeholder:text-ink-5 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors"
              />
            </div>

            <div class="flex flex-col gap-1.5">
              <label
                for="login-password"
                class="font-mono text-[10px] uppercase tracking-wider text-ink-3 dark:text-ink-5"
              >
                Contraseña
              </label>
              <input
                id="login-password"
                type="password"
                name="password"
                [(ngModel)]="password"
                autocomplete="current-password"
                placeholder="••••••••"
                class="w-full px-3 py-2.5 bg-bg-2 dark:bg-ink border border-line dark:border-ink-3 text-ink dark:text-bg text-sm font-sans placeholder:text-ink-4 dark:placeholder:text-ink-5 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition-colors"
              />
            </div>
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

          <button
            type="submit"
            class="w-full px-4 py-3 bg-ink dark:bg-bg text-bg dark:text-ink border border-ink dark:border-bg font-mono text-xs uppercase tracking-wider hover:opacity-90 active:opacity-95 transition-opacity disabled:opacity-45 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface dark:focus-visible:ring-offset-ink-2"
            [disabled]="loading()"
          >
            {{ loading() ? 'Entrando…' : 'Entrar' }}
          </button>
        </form>
      </div>
    </main>
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthFacade);
  private readonly router = inject(Router);

  /** Cuentas demo: un clic dispara login completo. */
  protected readonly demos = [
    { label: 'Hospital', email: 'hospital@demo.com', password: 'hospital' },
    { label: 'Aseguradora', email: 'insurer@demo.com', password: 'insurer' },
    { label: 'Auditor', email: 'auditor@demo.com', password: 'auditor' },
  ] as const;

  email = '';
  password = '';
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  submit(): void {
    this.attemptLogin(this.email.trim(), this.password);
  }

  loginWithDemo(email: string, password: string): void {
    this.email = email;
    this.password = password;
    this.attemptLogin(email.trim(), password);
  }

  private attemptLogin(email: string, password: string): void {
    if (!email || !password) {
      this.error.set('Completá el email y la contraseña.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.auth.login(email, password).subscribe({
      next: (user) => {
        this.loading.set(false);
        void this.router.navigate([`/${user.role}`]);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(this.formatLoginError(err));
      },
    });
  }

  private formatLoginError(err: unknown): string {
    if (!(err instanceof ApiError)) {
      return 'Error inesperado. Intentá de nuevo.';
    }
    let msg =
      typeof err.message === 'string' ? err.message : String(err.detail ?? err.title ?? err.message);

    if (/failed validation|validation error/i.test(msg)) {
      return 'Revisá el email y la contraseña (formato o datos incorrectos).';
    }
    if (err.status === 401 || err.status === 403) {
      return 'Credenciales incorrectas o sin permiso.';
    }
    return msg || 'No se pudo iniciar sesión.';
  }
}
