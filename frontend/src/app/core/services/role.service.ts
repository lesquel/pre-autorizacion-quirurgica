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
 * Source of truth is `AuthFacade.role` (derived from the JWT). The local
 * `_override` only applies when there is NO authenticated session — useful
 * for pre-login dev navigation. Once authenticated, the JWT role wins and
 * cannot be switched from the UI (no role-switcher in the topbar).
 */
@Injectable({ providedIn: 'root' })
export class RoleService {
  private readonly auth = inject(AuthFacade);
  private readonly _override = signal<Role | null>(loadInitial());

  readonly role = computed<Role>(() => {
    if (this.auth.isAuthenticated()) {
      return this.auth.role();
    }
    return this._override() ?? this.auth.role();
  });

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
