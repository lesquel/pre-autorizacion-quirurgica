import { Injectable, effect, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';

/**
 * Lee tema persistido desde localStorage. Si no existe, usa
 * `prefers-color-scheme` cuando esté disponible y cae a `'light'`.
 */
function loadInitial(): Theme {
  if (typeof window === 'undefined') return 'light';

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;

  const prefersDark =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;

  return prefersDark ? 'dark' : 'light';
}

/**
 * ThemeService — singleton que gestiona el tema (light/dark) usando signals.
 *
 * - Carga inicial: `localStorage['theme']` con fallback a `prefers-color-scheme`.
 * - Aplica `dark` class en `<html>` (Tailwind v4 dark variant).
 * - Persiste cambios en localStorage automáticamente vía effect.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _theme = signal<Theme>(loadInitial());

  readonly theme = this._theme.asReadonly();

  constructor() {
    const applyDom = (current: Theme): void => {
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('dark', current === 'dark');
      }
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, current);
      }
    };
    applyDom(this._theme());

    effect(() => {
      applyDom(this._theme());
    });
  }

  toggle(): void {
    this._theme.update((current) => (current === 'light' ? 'dark' : 'light'));
  }

  set(theme: Theme): void {
    this._theme.set(theme);
  }
}
