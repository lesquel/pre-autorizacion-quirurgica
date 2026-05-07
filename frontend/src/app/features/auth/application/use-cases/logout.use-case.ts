import { Injectable, inject } from '@angular/core';
import { catchError, of, tap, type Observable } from 'rxjs';

import { AuthRepository } from '../../domain/ports/auth-repository.port';
import { TokenStore } from '../../domain/ports/token-store.port';

@Injectable({ providedIn: 'root' })
export class LogoutUseCase {
  private readonly repo = inject(AuthRepository);
  private readonly store = inject(TokenStore);

  execute(): Observable<void> {
    return this.repo.logout().pipe(
      catchError(() => of(void 0)),
      tap(() => this.store.clear()),
    );
  }
}
