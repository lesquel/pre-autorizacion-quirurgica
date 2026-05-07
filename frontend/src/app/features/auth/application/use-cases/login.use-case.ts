import { Injectable, inject } from '@angular/core';
import { tap, type Observable } from 'rxjs';

import { AuthRepository, type LoginResult } from '../../domain/ports/auth-repository.port';
import { TokenStore } from '../../domain/ports/token-store.port';

@Injectable({ providedIn: 'root' })
export class LoginUseCase {
  private readonly repo = inject(AuthRepository);
  private readonly store = inject(TokenStore);

  execute(email: string, password: string): Observable<LoginResult> {
    return this.repo.login(email, password).pipe(
      tap((result) => this.store.set(result.tokens)),
    );
  }
}
