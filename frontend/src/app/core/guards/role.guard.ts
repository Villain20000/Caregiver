import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Role } from '../models/role.model';
import { RoleService } from '../services/role.service';

/**
 * Returns a CanActivateFn that allows access only when the active role
 * is in the supplied list. Falls back to /dashboard if denied.
 */
export function roleGuard(allowed: readonly Role[]): CanActivateFn {
  return () => {
    const roles = inject(RoleService);
    const router = inject(Router);
    if (roles.canAccess(allowed)) {
      return true;
    }
    return router.parseUrl('/dashboard');
  };
}
