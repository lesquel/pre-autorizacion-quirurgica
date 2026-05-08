import { Injectable, computed, inject, signal } from '@angular/core';
import { map, tap, type Observable } from 'rxjs';

import type { Role } from '../../../../core/types/role';
import type { User } from '../../domain/entities/user';
import { LoginUseCase } from '../use-cases/login.use-case';
import { LogoutUseCase } from '../use-cases/logout.use-case';
import { TokenStore } from '../../domain/ports/token-store.port';

/**
 * Clave bajo la que persistimos el `User` actual en `sessionStorage`.
 * Va separada del `TokenStore` porque el port solo modela tokens —
 * el user es responsabilidad de la facade.
 */
const USER_STORAGE_KEY = 'auth.user';

@Injectable({ providedIn: 'root' })
export class AuthFacade {
  private readonly loginUC = inject(LoginUseCase);
  private readonly logoutUC = inject(LogoutUseCase);
  private readonly tokens = inject(TokenStore);

  // Hidratamos la signal con el user persistido (si existe) para que
  // la sesión sobreviva a recargas de HMR / refresh manual de la pestaña.
  private readonly _user = signal<User | null>(this.hydrateUser());
  readonly currentUser = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly accessToken = computed(() => this.tokens.get()?.accessToken ?? null);
  readonly role = computed<Role>(() => this._user()?.role ?? 'hospital');

  login(email: string, password: string): Observable<User> {
    return this.loginUC.execute(email, password).pipe(
      tap((res) => {
        this._user.set(res.user);
        this.persistUser(res.user);
      }),
      map((res) => res.user),
    );
  }

  logout(): void {
    this.logoutUC.execute().subscribe();
    this._user.set(null);
    this.clearPersistedUser();
  }

  /**
   * Recupera el user de `sessionStorage` solo si además hay tokens
   * válidos en el `TokenStore`. Si falta cualquiera de los dos, la
   * sesión se considera inválida y devolvemos `null`.
   */
  private hydrateUser(): User | null {
    if (!this.hasBrowserStorage()) {
      return null;
    }

    // Sin tokens → no tiene sentido restaurar el user (sería una sesión zombi).
    if (this.tokens.get() === null) {
      return null;
    }

    try {
      const raw = window.sessionStorage.getItem(USER_STORAGE_KEY);
      if (raw === null) {
        return null;
      }
      return JSON.parse(raw) as User;
    } catch {
      // JSON corrupto o storage inaccesible: limpiamos y empezamos sin sesión.
      return null;
    }
  }

  private persistUser(user: User): void {
    if (!this.hasBrowserStorage()) {
      return;
    }
    try {
      window.sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } catch {
      // Quota / storage bloqueado: el user vive solo en memoria por esta sesión.
    }
  }

  private clearPersistedUser(): void {
    if (!this.hasBrowserStorage()) {
      return;
    }
    try {
      window.sessionStorage.removeItem(USER_STORAGE_KEY);
    } catch {
      // Ignoramos errores de storage en limpieza.
    }
  }

  private hasBrowserStorage(): boolean {
    return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
  }
}
