import { Injectable, inject } from '@angular/core';
import { tap, type Observable } from 'rxjs';

import { AuthRepository } from '../../domain/ports/auth-repository.port';
import { TokenStore } from '../../domain/ports/token-store.port';

@Injectable({ providedIn: 'root' })
export class RefreshSessionUseCase {
  private readonly repo = inject(AuthRepository);
  private readonly store = inject(TokenStore);

  execute(): Observable<{ accessToken: string }> {
    const tokens = this.store.get();
    if (!tokens) {
      throw new Error('No refresh token available');
    }
    return this.repo.refresh(tokens.refreshToken).pipe(
      tap((res) =>
        this.store.set({ accessToken: res.accessToken, refreshToken: tokens.refreshToken }),
      ),
    );
  }
}
