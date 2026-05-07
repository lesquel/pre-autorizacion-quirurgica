import type { AuthTokens } from '../value-objects/auth-tokens';

export abstract class TokenStore {
  abstract get(): AuthTokens | null;
  abstract set(tokens: AuthTokens): void;
  abstract clear(): void;
}
