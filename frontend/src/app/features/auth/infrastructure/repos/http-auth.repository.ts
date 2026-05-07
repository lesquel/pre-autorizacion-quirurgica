import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL } from '../../../../shared/api/api-base-url.token';
import { AuthRepository, type LoginResult } from '../../domain/ports/auth-repository.port';
import type { User } from '../../domain/entities/user';

interface LoginResponseDto {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; name: string; role: User['role'] };
}

interface RefreshResponseDto {
  accessToken: string;
}

@Injectable({ providedIn: 'root' })
export class HttpAuthRepository extends AuthRepository {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  override login(email: string, password: string): Observable<LoginResult> {
    return this.http
      .post<LoginResponseDto>(`${this.base}/api/v1/auth/login`, { email, password })
      .pipe(
        map((dto) => ({
          tokens: { accessToken: dto.accessToken, refreshToken: dto.refreshToken },
          user: dto.user,
        })),
      );
  }

  override refresh(refreshToken: string): Observable<{ accessToken: string }> {
    return this.http.post<RefreshResponseDto>(
      `${this.base}/api/v1/auth/refresh`,
      { refreshToken },
    );
  }

  override me(): Observable<User> {
    return this.http.get<User>(`${this.base}/api/v1/auth/me`);
  }

  override logout(): Observable<void> {
    return this.http.post<void>(`${this.base}/api/v1/auth/logout`, {});
  }
}
