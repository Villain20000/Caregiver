import { Injectable, computed, inject } from '@angular/core';
import { RoleService } from './role.service';
import { User } from '../models/user.model';

/**
 * Auth service backed by the Express database.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly roles = inject(RoleService);

  readonly currentUser = computed<User>(() => this.roles.currentUser());
  readonly isAuthenticated = computed<boolean>(() => !!this.currentUser());
  readonly isStaff = computed<boolean>(() => {
    const r = this.roles.activeRole();
    return (
      r !== ('patient' as typeof r) &&
      r !== ('family' as typeof r)
    );
  });

  readonly allUsers = computed<User[]>(() => this.roles.users());

  getUserById(id: string): User | undefined {
    return this.roles.users().find((u) => u.id === id);
  }

  signInAs(userId: string): void {
    const u = this.getUserById(userId);
    if (u) {
      this.roles.setRole(u.role);
    }
  }

  signOut(): void {
    // demo: revert to admin (a safe default)
    this.roles.setRole(this.roles.activeRole());
  }
}
