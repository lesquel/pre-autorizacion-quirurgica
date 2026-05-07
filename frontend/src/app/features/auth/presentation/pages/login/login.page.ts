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
    <main class="min-h-screen flex items-center justify-center bg-base-100 p-6">
      <form
        (ngSubmit)="submit()"
        class="card w-full max-w-md bg-base-200 p-6 shadow-xl space-y-4"
      >
        <h1 class="text-2xl font-semibold">Iniciar sesión</h1>

        <label class="form-control">
          <span class="label-text">Email</span>
          <input
            type="email"
            class="input input-bordered"
            name="email"
            [(ngModel)]="email"
            required
            autocomplete="email"
          />
        </label>

        <label class="form-control">
          <span class="label-text">Contraseña</span>
          <input
            type="password"
            class="input input-bordered"
            name="password"
            [(ngModel)]="password"
            required
            autocomplete="current-password"
          />
        </label>

        @if (error()) {
          <p class="text-error text-sm">{{ error() }}</p>
        }

        <button type="submit" class="btn btn-primary w-full" [disabled]="loading()">
          {{ loading() ? 'Entrando…' : 'Entrar' }}
        </button>

        <p class="text-xs opacity-70">
          Demo: hospital@demo.com / hospital · insurer@demo.com / insurer · auditor@demo.com / auditor
        </p>
      </form>
    </main>
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthFacade);
  private readonly router = inject(Router);

  email = '';
  password = '';
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  submit(): void {
    this.loading.set(true);
    this.error.set(null);
    this.auth.login(this.email, this.password).subscribe({
      next: (user) => {
        this.loading.set(false);
        void this.router.navigate([`/${user.role}`]);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(err instanceof ApiError ? err.message : 'Error inesperado.');
      },
    });
  }
}
