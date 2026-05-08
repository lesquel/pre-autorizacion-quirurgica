import { Injectable } from '@angular/core';

import type { AuthTokens } from '../../domain/value-objects/auth-tokens';
import { TokenStore } from '../../domain/ports/token-store.port';

/**
 * Clave única bajo la que persistimos AMBOS tokens como un único blob JSON.
 *
 * Antes había dos claves separadas (`auth.access_token`, `auth.refresh_token`)
 * y el `set()` hacía dos `setItem` no-atómicos: si el segundo fallaba (quota,
 * disable a mitad de la operación), el storage quedaba con un estado divergente
 * (access nuevo + refresh viejo). Un único blob garantiza atomicidad de set/get.
 */
const TOKENS_STORAGE_KEY = 'auth.tokens';

/**
 * Claves legacy (formato anterior). Las leemos al boot UNA VEZ para migrar al
 * formato nuevo y luego las borramos. No persistimos nuevos valores acá.
 */
const LEGACY_ACCESS_TOKEN_KEY = 'auth.access_token';
const LEGACY_REFRESH_TOKEN_KEY = 'auth.refresh_token';

/**
 * Canal de broadcast para sincronizar logout / refresh entre pestañas.
 *
 * Problema que resuelve: `sessionStorage` se clona al duplicar pestaña, así que
 * el logout en una tab dejaba a la otra tab autenticada con tokens válidos
 * ("zombie session"). Con `BroadcastChannel` la pestaña que hace logout
 * (o refrescó tokens) emite un evento y las otras pestañas limpian / recargan
 * su fallback en memoria.
 */
const AUTH_BROADCAST_CHANNEL = 'auth';

/**
 * Mensaje que viaja por `BroadcastChannel('auth')`.
 *
 * Para `token-refresh` incluimos los tokens en el payload — `sessionStorage`
 * es per-tab así que la receptora no puede leerlos del storage de la
 * emisora. BroadcastChannel es same-origin only, así que el viaje es seguro.
 */
type AuthBroadcastMessage =
  | { readonly kind: 'logout' }
  | { readonly kind: 'token-refresh'; readonly tokens: AuthTokens };

/**
 * Implementación de `TokenStore` que persiste en `sessionStorage`.
 *
 * Motivación: el `InMemoryTokenStore` pierde la sesión en cada recarga
 * del bundler en `ng serve` (HMR), expulsando al usuario a `/login` en
 * cada edición. `sessionStorage` sobrevive recargas de la pestaña y se
 * limpia automáticamente al cerrarla — más limpio que `localStorage`
 * (no persiste cross-session) y reduce la ventana de exposición ante XSS.
 *
 * Cross-tab: usamos un `BroadcastChannel('auth')` para emitir `logout` /
 * `token-refresh` y mantener pestañas duplicadas en sync.
 *
 * SSR-safe: si no hay `window` (build server-side), caemos a un fallback
 * en memoria con el mismo comportamiento que el store original.
 */
@Injectable({ providedIn: 'root' })
export class SessionStorageTokenStore extends TokenStore {
  /** Fallback en memoria cuando no hay `window` (SSR / tests sin DOM). */
  private memoryFallback: AuthTokens | null = null;

  /**
   * Canal de broadcast (lazy: undefined si la API no está disponible).
   * No usamos `BroadcastChannel | null` porque queremos distinguir
   * "no inicializado todavía" de "no soportado".
   */
  private readonly broadcast: BroadcastChannel | undefined =
    this.createBroadcastChannel();

  constructor() {
    super();
    // Migrar formato viejo → nuevo si todavía hay claves legacy en storage.
    this.migrateLegacyKeys();
    // Suscribir a eventos cross-tab para limpiar nuestro fallback en memoria
    // si OTRA pestaña hizo logout (sessionStorage es por-pestaña; no podemos
    // limpiar el de las otras tabs — pero sí podemos pedirles que reaccionen).
    if (this.broadcast !== undefined) {
      this.broadcast.addEventListener('message', (ev) => {
        const data = ev.data as AuthBroadcastMessage | undefined;
        if (data?.kind === 'logout') {
          this.memoryFallback = null;
          // Limpiamos también nuestro propio sessionStorage: si esta tab fue
          // duplicada de la que hizo logout, comparten el snapshot inicial.
          this.clearStorageSilently();
        } else if (data?.kind === 'token-refresh') {
          // Otra pestaña refrescó tokens. Recibimos los tokens NUEVOS en el
          // payload del mensaje y los aplicamos a NUESTRO sessionStorage +
          // memoryFallback. Antes leíamos sessionStorage local (que es
          // per-tab) — eso era inerte para tabs distintas. Ahora sí
          // sincronizamos cross-tab.
          if (isValidAuthTokens(data.tokens)) {
            this.applyTokens(data.tokens);
          }
        }
      });
    }
  }

  /**
   * Aplica `tokens` a memoryFallback + sessionStorage local. Llamado tanto
   * desde `set()` como desde el handler de `token-refresh` cross-tab.
   * Idempotente: si el storage falla, el fallback en memoria queda con la
   * versión correcta y la sesión sobrevive hasta el próximo reload.
   */
  private applyTokens(tokens: AuthTokens): void {
    this.memoryFallback = tokens;
    if (!this.hasBrowserStorage()) {
      return;
    }
    try {
      window.sessionStorage.setItem(
        TOKENS_STORAGE_KEY,
        JSON.stringify({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        }),
      );
    } catch {
      // Quota / storage deshabilitado: nos quedamos con el memoryFallback.
    }
  }

  override get(): AuthTokens | null {
    // Sin window → no podemos leer storage; servimos desde memoria.
    if (!this.hasBrowserStorage()) {
      return this.memoryFallback;
    }

    try {
      const raw = window.sessionStorage.getItem(TOKENS_STORAGE_KEY);
      if (raw === null) {
        return null;
      }
      const parsed: unknown = JSON.parse(raw);
      if (!isValidAuthTokens(parsed)) {
        // Blob corrupto o forma inesperada → tratamos como no autenticado.
        return null;
      }
      return parsed;
    } catch {
      // Si el storage está corrupto o el browser bloquea el acceso,
      // devolvemos null (equivale a "no hay sesión") en vez de romper.
      return null;
    }
  }

  override set(tokens: AuthTokens): void {
    // Set ATÓMICO: un único `setItem` con ambos tokens serializados.
    // Si falla, el storage queda en su estado anterior (no divergente).
    this.applyTokens(tokens);
    // Emitimos token-refresh CON los tokens en el payload para que otras
    // pestañas (que tienen su propio sessionStorage per-tab) los apliquen
    // localmente. Cross-tab same-origin only — BroadcastChannel garantiza
    // que el mensaje no cruza orígenes.
    this.broadcastSilently({ kind: 'token-refresh', tokens });
  }

  override clear(): void {
    this.memoryFallback = null;
    this.clearStorageSilently();
    // Avisar a otras pestañas que ya no estamos autenticados.
    this.broadcastSilently({ kind: 'logout' });
  }

  /**
   * Verifica que estemos en un entorno con `window.sessionStorage`
   * disponible (browser real, no SSR ni tests Node sin DOM).
   */
  private hasBrowserStorage(): boolean {
    return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
  }

  /**
   * Migra el formato viejo (dos claves separadas) al nuevo (blob único).
   * Idempotente — si ya migramos, las claves legacy no existen y es no-op.
   */
  private migrateLegacyKeys(): void {
    if (!this.hasBrowserStorage()) {
      return;
    }
    try {
      const legacyAccess = window.sessionStorage.getItem(LEGACY_ACCESS_TOKEN_KEY);
      const legacyRefresh = window.sessionStorage.getItem(LEGACY_REFRESH_TOKEN_KEY);
      if (legacyAccess !== null && legacyRefresh !== null) {
        // Sólo migramos si NO hay blob nuevo todavía (no pisamos un set posterior).
        const existing = window.sessionStorage.getItem(TOKENS_STORAGE_KEY);
        if (existing === null) {
          window.sessionStorage.setItem(
            TOKENS_STORAGE_KEY,
            JSON.stringify({
              accessToken: legacyAccess,
              refreshToken: legacyRefresh,
            }),
          );
        }
      }
      // Borramos claves legacy independientemente: no queremos arrastrar formato viejo.
      if (legacyAccess !== null) {
        window.sessionStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
      }
      if (legacyRefresh !== null) {
        window.sessionStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY);
      }
    } catch {
      // Storage inaccesible / quota / etc: no-op. El próximo `set()` reescribirá.
    }
  }

  private clearStorageSilently(): void {
    if (!this.hasBrowserStorage()) {
      return;
    }
    try {
      window.sessionStorage.removeItem(TOKENS_STORAGE_KEY);
    } catch {
      // Ignoramos errores: el estado en memoria ya quedó limpio.
    }
  }

  /**
   * Crea el `BroadcastChannel` si la API está disponible. En entornos sin
   * soporte (Node sin DOM, navegadores muy viejos, SSR), retornamos undefined
   * y el store opera sin cross-tab sync (graceful degrade).
   */
  private createBroadcastChannel(): BroadcastChannel | undefined {
    if (typeof BroadcastChannel === 'undefined') {
      // Graceful degrade: sin BroadcastChannel cada pestaña vive aislada.
      // El logout en una tab NO limpia las otras hasta su próximo refresh.
      return undefined;
    }
    try {
      return new BroadcastChannel(AUTH_BROADCAST_CHANNEL);
    } catch {
      return undefined;
    }
  }

  private broadcastSilently(message: AuthBroadcastMessage): void {
    if (this.broadcast === undefined) {
      return;
    }
    try {
      this.broadcast.postMessage(message);
    } catch {
      // Si el canal fue cerrado / browser bloqueó: no-op.
    }
  }
}

/**
 * Type guard para `AuthTokens` — valida shape mínima del blob deserializado.
 * Evita confiar ciegamente en JSON arbitrario de `sessionStorage` (que un
 * atacante con XSS podría haber escrito).
 */
function isValidAuthTokens(value: unknown): value is AuthTokens {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    typeof obj['accessToken'] === 'string' &&
    obj['accessToken'].length > 0 &&
    typeof obj['refreshToken'] === 'string' &&
    obj['refreshToken'].length > 0
  );
}
