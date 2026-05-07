import { Injectable } from '@angular/core';

import type { AuthTokens } from '../../domain/value-objects/auth-tokens';
import { TokenStore } from '../../domain/ports/token-store.port';

@Injectable({ providedIn: 'root' })
export class InMemoryTokenStore extends TokenStore {
  private tokens: AuthTokens | null = null;

  override get(): AuthTokens | null {
    return this.tokens;
  }

  override set(tokens: AuthTokens): void {
    this.tokens = tokens;
  }

  override clear(): void {
    this.tokens = null;
  }
}
