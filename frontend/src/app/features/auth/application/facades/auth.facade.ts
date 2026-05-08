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

/** Whitelist de roles aceptados para hydrate (sirve también como type guard). */
const ALLOWED_ROLES = ['hospital', 'insurer', 'auditor'] as const satisfies readonly Role[];

// Compile-time check: si `Role` agrega un valor, este alias rompe la build.
// Evita que la whitelist quede silenciosamente desactualizada respecto al type.
type _AllowedRolesExhaustive = Exclude<Role, (typeof ALLOWED_ROLES)[number]> extends never
  ? true
  : ['ALLOWED_ROLES out of sync with Role:', Exclude<Role, (typeof ALLOWED_ROLES)[number]>];
// Forzamos el uso del alias — si dejamos el `type` huérfano, TS / linters
// lo dead-code-eliminan y el guard nunca se evalúa en build.
const _ALLOWED_ROLES_CHECK: _AllowedRolesExhaustive = true;
void _ALLOWED_ROLES_CHECK;

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
   * válidos (no expirados) en el `TokenStore`. Si falta cualquiera de los
   * dos, la sesión se considera inválida y devolvemos `null`.
   *
   * Endurecimiento contra XSS: NO confiamos en el JSON deserializado.
   * Validamos shape, tipos primitivos Y que `role` esté en la whitelist
   * — un atacante con XSS podría escribir `{role:'auditor'}` para escalar
   * privilegios; el type guard lo rechaza. Si pasa la validación pero el
   * access token está expirado (campo `exp` del JWT), también devolvemos
   * null y limpiamos el storage zombie.
   */
  private hydrateUser(): User | null {
    if (!this.hasBrowserStorage()) {
      return null;
    }

    // Sin tokens → no tiene sentido restaurar el user (sería una sesión zombi).
    const tokens = this.tokens.get();
    if (tokens === null) {
      return null;
    }

    // Si el access token está expirado, no rehidratamos. Limpiamos el storage
    // para no dejar artefactos "fantasma" que se vean en otra navegación.
    if (isJwtExpired(tokens.accessToken)) {
      try {
        window.sessionStorage.removeItem(USER_STORAGE_KEY);
      } catch {
        // ignoramos errores de storage en limpieza
      }
      this.tokens.clear();
      return null;
    }

    try {
      const raw = window.sessionStorage.getItem(USER_STORAGE_KEY);
      if (raw === null) {
        return null;
      }
      const parsed: unknown = JSON.parse(raw);
      if (!isValidUser(parsed)) {
        // Shape inválida o role no permitido — log estructurado para diagnóstico.
        // eslint-disable-next-line no-console
        console.warn('auth.hydrate.invalid_user', {
          reason: 'session-storage user blob did not pass type guard',
        });
        return null;
      }
      return parsed;
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

/**
 * Type guard estricto para `User`. Valida shape Y rol contra la whitelist.
 *
 * Motivación: un cast directo `JSON.parse(raw) as User` confía en bytes
 * arbitrarios de `sessionStorage`. Si un atacante con XSS escribe
 * `{ id:'x', email:'x', name:'x', role:'auditor' }`, el cast lo acepta y
 * el atacante escala. Acá cada campo se chequea explícitamente y `role`
 * tiene que matchear `ALLOWED_ROLES`.
 */
function isValidUser(value: unknown): value is User {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const obj = value as Record<string, unknown>;
  if (typeof obj['id'] !== 'string' || obj['id'].length === 0) return false;
  if (typeof obj['email'] !== 'string' || obj['email'].length === 0) return false;
  if (typeof obj['name'] !== 'string') return false;
  if (typeof obj['role'] !== 'string' || obj['role'].length === 0) return false;
  if (!ALLOWED_ROLES.includes(obj['role'] as Role)) return false;
  return true;
}

/**
 * Decodifica el payload del JWT (sin validar la firma — eso es server-side)
 * y chequea el campo `exp` contra `Date.now()`. Devuelve `true` si está
 * expirado o si no se puede parsear (defensa: token inválido = no confiable).
 *
 * Nota: la firma se valida en el backend con cada request — acá sólo
 * evitamos un trip al server con un token claramente vencido.
 */
function isJwtExpired(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    // base64url → base64 estándar para que `atob` lo entienda.
    // base64url omite el padding `=`; sin él, `atob()` falla con
    // `InvalidCharacterError` cuando la longitud del payload no es
    // múltiplo de 4 (ej: muchos JWT con campos de fecha). Reagregamos.
    const payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = '='.repeat((4 - (payloadB64.length % 4)) % 4);
    const payloadJson = atob(payloadB64 + pad);
    const payload: unknown = JSON.parse(payloadJson);
    if (
      payload === null ||
      typeof payload !== 'object' ||
      typeof (payload as Record<string, unknown>)['exp'] !== 'number'
    ) {
      // Sin `exp`: tratamos como expirado para no confiar en JWT raros.
      return true;
    }
    const exp = (payload as { exp: number }).exp;
    const nowSeconds = Math.floor(Date.now() / 1000);
    return exp <= nowSeconds;
  } catch {
    // Cualquier error de parseo → tratamos como expirado.
    return true;
  }
}
