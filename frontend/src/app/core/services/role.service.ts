import { Injectable, effect, signal } from '@angular/core';

import type { Role } from '../types/role';

const STORAGE_KEY = 'role';
const VALID_ROLES: readonly Role[] = ['hospital', 'insurer', 'auditor'];

function isRole(value: string | null): value is Role {
  return value !== null && (VALID_ROLES as readonly string[]).includes(value);
}

function loadInitial(): Role {
  if (typeof window === 'undefined') return 'hospital';

  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isRole(stored) ? stored : 'hospital';
}

/**
 * RoleService — singleton que gestiona el rol activo (hospital/insurer/auditor).
 *
 * Persiste el rol en `localStorage['role']` automáticamente y expone un
 * signal readonly para consumidores. Cambios pasan por `set()`.
 */
@Injectable({ providedIn: 'root' })
export class RoleService {
  private readonly _role = signal<Role>(loadInitial());

  readonly role = this._role.asReadonly();

  constructor() {
    effect(() => {
      if (typeof window === 'undefined') return;
      window.localStorage.setItem(STORAGE_KEY, this._role());
    });
  }

  set(role: Role): void {
    this._role.set(role);
  }
}
