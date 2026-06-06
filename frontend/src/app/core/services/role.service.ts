import { Injectable, computed, effect, signal } from '@angular/core';
import { Role, ALL_ROLES } from '../models/role.model';
import { MOCK_USERS, User } from '../models/user.model';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from './api.config';

const STORAGE_KEY = 'carevibe.activeRole';

@Injectable({ providedIn: 'root' })
export class RoleService {
  private readonly _activeRole = signal<Role>(this.readPersistedRole());
  private readonly _users = signal<User[]>([]);

  readonly activeRole = this._activeRole.asReadonly();
  readonly users = this._users.asReadonly();

  readonly currentUser = computed<User>(() => {
    const role = this._activeRole();
    const list = this._users();
    const found = list.find((u) => u.role === role);
    return found ?? MOCK_USERS.find((u) => u.role === role) ?? MOCK_USERS[0];
  });

  /** Friendly label for the active role. */
  readonly currentLabel = computed<string>(() => {
    const role = this._activeRole();
    const user = this.currentUser();
    return `${user.name} · ${role}`;
  });

  /** All selectable roles, in display order. */
  readonly allRoles = computed<readonly Role[]>(() => ALL_ROLES);

  constructor(private readonly http: HttpClient) {
    this.loadUsers();
    // Persist any future role change
    effect(() => {
      const r = this._activeRole();
      try {
        localStorage.setItem(STORAGE_KEY, r);
      } catch {
        /* localStorage may be unavailable in SSR / private mode */
      }
    });
  }

  loadUsers(): void {
    this.http.get<User[]>(`${API_BASE_URL}/users`).subscribe({
      next: (data) => this._users.set(data),
      error: (err) => console.error('Failed to load users for RoleService', err)
    });
  }

  setRole(role: Role): void {
    this._activeRole.set(role);
  }

  canAccess(roles: readonly Role[]): boolean {
    if (!roles || roles.length === 0) {
      return true;
    }
    return roles.includes(this._activeRole());
  }

  hasAny(roles: readonly Role[]): boolean {
    return this.canAccess(roles);
  }

  hasRole(role: Role): boolean {
    return this._activeRole() === role;
  }

  private readPersistedRole(): Role {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v && (ALL_ROLES as readonly string[]).includes(v)) {
        return v as Role;
      }
    } catch {
      /* ignore */
    }
    return Role.ADMIN;
  }
}
