import { Injectable } from '@angular/core';

import type { AuthTokens } from '../../domain/value-objects/auth-tokens';
import { TokenStore } from '../../domain/ports/token-store.port';

/**
 * Claves bajo las que persistimos los tokens en sessionStorage.
 * Mantenemos el prefijo `auth.` para namespacing y futuras extensiones.
 */
const ACCESS_TOKEN_KEY = 'auth.access_token';
const REFRESH_TOKEN_KEY = 'auth.refresh_token';

/**
 * Implementación de `TokenStore` que persiste en `sessionStorage`.
 *
 * Motivación: el `InMemoryTokenStore` pierde la sesión en cada recarga
 * del bundler en `ng serve` (HMR), expulsando al usuario a `/login` en
 * cada edición. `sessionStorage` sobrevive recargas de la pestaña y se
 * limpia automáticamente al cerrarla — más limpio que `localStorage`
 * (no persiste cross-session) y reduce la ventana de exposición ante XSS.
 *
 * SSR-safe: si no hay `window` (build server-side), caemos a un fallback
 * en memoria con el mismo comportamiento que el store original.
 */
@Injectable({ providedIn: 'root' })
export class SessionStorageTokenStore extends TokenStore {
  /** Fallback en memoria cuando no hay `window` (SSR / tests sin DOM). */
  private memoryFallback: AuthTokens | null = null;

  override get(): AuthTokens | null {
    // Sin window → no podemos leer storage; servimos desde memoria.
    if (!this.hasBrowserStorage()) {
      return this.memoryFallback;
    }

    try {
      const accessToken = window.sessionStorage.getItem(ACCESS_TOKEN_KEY);
      const refreshToken = window.sessionStorage.getItem(REFRESH_TOKEN_KEY);

      // Si falta cualquiera de los dos, consideramos que no hay sesión.
      if (accessToken === null || refreshToken === null) {
        return null;
      }

      return { accessToken, refreshToken };
    } catch {
      // Si el storage está corrupto o el browser bloquea el acceso,
      // devolvemos null (equivale a "no hay sesión") en vez de romper.
      return null;
    }
  }

  override set(tokens: AuthTokens): void {
    // Siempre actualizamos el fallback en memoria — barato y útil
    // si el storage falla a mitad de la operación.
    this.memoryFallback = tokens;

    if (!this.hasBrowserStorage()) {
      return;
    }

    try {
      window.sessionStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
      window.sessionStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
    } catch {
      // Quota exceeded o storage deshabilitado: nos quedamos con el
      // fallback en memoria. La sesión vive hasta el próximo reload.
    }
  }

  override clear(): void {
    this.memoryFallback = null;

    if (!this.hasBrowserStorage()) {
      return;
    }

    try {
      window.sessionStorage.removeItem(ACCESS_TOKEN_KEY);
      window.sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    } catch {
      // Ignoramos errores: el estado en memoria ya quedó limpio.
    }
  }

  /**
   * Verifica que estemos en un entorno con `window.sessionStorage`
   * disponible (browser real, no SSR ni tests Node sin DOM).
   */
  private hasBrowserStorage(): boolean {
    return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
  }
}
