import { Injectable, signal, computed } from '@angular/core';
import { Role, UserSession } from '../models';

/**
 * SessionService - holds the current user session (role, name, id).
 * In a real app this would be backed by Auth; for the prototype it is
 * a signal-driven singleton.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly _user = signal<UserSession>({
    id: 'u-001',
    name: 'Dr. Alex Morgan',
    role: Role.DOCTOR,
    avatar: 'AM',
  });

  readonly user = this._user.asReadonly();
  readonly role = computed<Role>(() => this._user().role);

  setRole(role: Role): void {
    this._user.update((u) => ({ ...u, role }));
  }

  hasRole(roles: Role[]): boolean {
    return roles.includes(this._user().role);
  }
}
