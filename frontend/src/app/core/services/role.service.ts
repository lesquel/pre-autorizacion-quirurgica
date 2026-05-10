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
 * RoleService — exposes the active role to the UI.
 *
 * Para el demo/MVP el rol activo puede diferir del rol del JWT: el usuario
 * loguea con cualquier cuenta y el role-switcher de la topbar decide qué
 * dashboard ver. El `_override` (persistido en localStorage) gana sobre el
 * rol del JWT cuando está seteado. `clearOverride()` vuelve al rol del JWT.
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

  set(role: Role): void {
    this._override.set(role);
  }

  clearOverride(): void {
    this._override.set(null);
  }
}
