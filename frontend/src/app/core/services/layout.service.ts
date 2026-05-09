import { Injectable, signal } from '@angular/core';

/**
 * LayoutService — coordina el estado del shell entre topbar/shell/sidenav.
 *
 * En mobile (< lg, o sea < 1024px) el sidenav es un drawer off-canvas que se
 * abre/cierra con el hamburger del topbar. En desktop (lg+) el sidenav vive
 * fijo en la grid del shell y este flag es ignorado por el layout (el sidenav
 * se ve siempre).
 */
@Injectable({ providedIn: 'root' })
export class LayoutService {
  private readonly _sidenavOpen = signal(false);

  /** ¿Está abierto el drawer en mobile? Sin efecto en desktop (siempre visible). */
  readonly sidenavOpen = this._sidenavOpen.asReadonly();

  toggleSidenav(): void {
    this._sidenavOpen.update((v) => !v);
  }

  openSidenav(): void {
    this._sidenavOpen.set(true);
  }

  closeSidenav(): void {
    this._sidenavOpen.set(false);
  }
}
