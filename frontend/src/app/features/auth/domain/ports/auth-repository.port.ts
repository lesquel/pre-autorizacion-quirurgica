import type { Observable } from 'rxjs';

import type { User } from '../entities/user';
import type { AuthTokens } from '../value-objects/auth-tokens';

export interface LoginResult {
  readonly tokens: AuthTokens;
  readonly user: User;
}

export abstract class AuthRepository {
  abstract login(email: string, password: string): Observable<LoginResult>;
  abstract refresh(refreshToken: string): Observable<{ accessToken: string }>;
  abstract me(): Observable<User>;
  abstract logout(): Observable<void>;
}
