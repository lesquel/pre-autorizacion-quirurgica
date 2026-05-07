import { Injectable, computed, inject, signal } from '@angular/core';
import { map, tap, type Observable } from 'rxjs';

import type { Role } from '../../../../core/types/role';
import type { User } from '../../domain/entities/user';
import { LoginUseCase } from '../use-cases/login.use-case';
import { LogoutUseCase } from '../use-cases/logout.use-case';
import { TokenStore } from '../../domain/ports/token-store.port';

@Injectable({ providedIn: 'root' })
export class AuthFacade {
  private readonly loginUC = inject(LoginUseCase);
  private readonly logoutUC = inject(LogoutUseCase);
  private readonly tokens = inject(TokenStore);

  private readonly _user = signal<User | null>(null);
  readonly currentUser = this._user.asReadonly();
  readonly isAuthenticated = computed(() => this._user() !== null);
  readonly accessToken = computed(() => this.tokens.get()?.accessToken ?? null);
  readonly role = computed<Role>(() => this._user()?.role ?? 'hospital');

  login(email: string, password: string): Observable<User> {
    return this.loginUC.execute(email, password).pipe(
      tap((res) => this._user.set(res.user)),
      map((res) => res.user),
    );
  }

  logout(): void {
    this.logoutUC.execute().subscribe();
    this._user.set(null);
  }
}
