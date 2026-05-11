import { Injectable, computed, effect, inject, signal } from '@angular/core';

import type { Role } from '../types/role';
import { AuthFacade } from '../../features/auth/application/facades/auth.facade';

const STORAGE_KEY = 'role';
const VALID_ROLES: readonly Role[] = ['hospital', 'insurer', 'auditor'];

function isRole(value: string | null): value is Role {
  return value !== null && (VALID_ROLES as readonly string[]).includes(value);
}

function loadInitial(): Role | null {
  if (typeof window === 'undefined') return null;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isRole(stored) ? stored : null;
}

/**
 * Credenciales de los demo users — usadas para auto-re-login cuando el
 * usuario cambia de rol con el segmented control del topbar.
 *
 * Razón: el backend hace RBAC contra el `role` del JWT, no contra una
 * "vista UI". Si el usuario logueó como hospital y luego cambia al
 * segmented de Aseguradora para crear una póliza, el backend rechaza
 * con 403 ("Role 'hospital' not allowed. Required: ['insurer']").
 *
 * El demo está pensado para mostrar los 3 flujos sin pedir 3 logins —
 * por eso el segmented hace re-login automático con el demo user del
 * rol nuevo. En producción esto no se haría así (cada user real tiene
 * su propio token); el demo de hackathon usa este atajo.
 */
const DEMO_CREDENTIALS: Readonly<Record<Role, { email: string; password: string }>> = {
  hospital: { email: 'hospital@demo.com', password: 'hospital' },
  insurer: { email: 'insurer@demo.com', password: 'insurer' },
  auditor: { email: 'auditor@demo.com', password: 'auditor' },
};

/**
 * RoleService — exposes the active role to the UI.
 *
 * Para el demo/MVP el rol activo puede diferir del rol del JWT: el usuario
 * loguea con cualquier cuenta y el role-switcher de la topbar decide qué
 * dashboard ver. El `_override` (persistido en localStorage) gana sobre el
 * rol del JWT cuando está seteado. `clearOverride()` vuelve al rol del JWT.
 *
 * IMPORTANTE: `set(role)` además dispara un re-login automático contra el
 * demo user correspondiente cuando hay sesión activa, para que el JWT
 * matchee el rol UI. Sin esto, acciones que requieren RBAC (crear póliza,
 * resolver caso) fallan con 403.
 */
@Injectable({ providedIn: 'root' })
export class RoleService {
  private readonly auth = inject(AuthFacade);
  private readonly _override = signal<Role | null>(loadInitial());

  readonly role = computed<Role>(() => this._override() ?? this.auth.role());

  constructor() {
    effect(() => {
      if (typeof window === 'undefined') return;
      const ov = this._override();
      if (ov) {
        window.localStorage.setItem(STORAGE_KEY, ov);
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    });
  }

  /**
   * Setea el rol UI. Si hay sesión activa y el rol del JWT NO coincide
   * con el nuevo rol, hace re-login con el demo user del rol nuevo —
   * de modo que el backend acepte acciones del rol seleccionado.
   *
   * Si no hay sesión, solo guarda el override (lo usará el guard tras
   * el siguiente login).
   */
  set(role: Role): void {
    this._override.set(role);

    // No-op si no hay sesión, o si el rol del JWT actual ya coincide.
    const currentUser = this.auth.currentUser();
    if (currentUser === null) return;
    if (currentUser.role === role) return;

    const creds = DEMO_CREDENTIALS[role];
    // Fire-and-forget: el login actualiza el AuthFacade signal → todos
    // los effects que dependen de `auth.isAuthenticated()` / `currentUser()`
    // se vuelven a evaluar (loadAll bootstrap, etc).
    this.auth.login(creds.email, creds.password).subscribe({
      error: (err: unknown) => {
        // eslint-disable-next-line no-console
        console.warn('role.reauth.failed', { role, err });
      },
    });
  }

  clearOverride(): void {
    this._override.set(null);
  }
}
