/**
 * apps/web/src/app/guards/rbac.guard.ts
 *
 * RBAC route guard — protects routes based on the user's role permissions.
 *
 * Works alongside authGuard (which checks authentication). This guard checks
 * whether the user's role has at least 'allow' or 'conditional' access to the
 * required feature specified in the route's `data.requiredPermission`.
 *
 * Usage in routes:
 *   {
 *     path: 'orders',
 *     canActivate: [authGuard, rbacGuard],
 *     data: { requiredPermission: 'order.lab_create' },
 *     loadComponent: () => ...,
 *   }
 *
 * 📝 Angular Concepts Demonstrated:
 *   - **Functional guard** (Angular functional router guards)
 *   - **Route data** for passing metadata to guards
 *   - **Composing multiple guards** (authGuard then rbacGuard)
 *   - **inject()** in standalone functions
 *   - **hasPermission** from @caregiver/rbac for runtime checks
 */
import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service.js';
import { hasPermission, type Role, type Feature } from '@caregiver/rbac';

/**
 * Route data key for the required permission.
 * Routes set this in their `data` property to specify which permission
 * is needed to access the route.
 *
 * @example
 *   data: { requiredPermission: 'order.lab_create' }
 */
export const REQUIRED_PERMISSION_KEY = 'requiredPermission';

/**
 * RBAC functional guard — checks if the authenticated user's role has
 * the required permission to access the route.
 *
 * If the user does not have permission, redirects to /dashboard with
 * a message (simulating a forbidden page experience).
 */
export const rbacGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Get the required permission from route data.
  const requiredFeature = route.data?.[REQUIRED_PERMISSION_KEY] as Feature | undefined;

  // If no permission is required, allow access (auth only is enough).
  if (!requiredFeature) {
    return true;
  }

  // Get the current user's role from the auth service signal.
  const userRole = authService.userRole() as Role | null;
  if (!userRole) {
    // No role found — redirect to dashboard (shouldn't happen if authGuard ran first).
    void router.navigate(['/dashboard']);
    return false;
  }

  // Check the permission matrix.
  const permission = hasPermission(userRole, requiredFeature);

  // Allow if permission is 'allow' or 'conditional'.
  // 'deny' means the role cannot access this feature at all.
  if (permission === 'allow' || permission === 'conditional') {
    return true;
  }

  // Deny — redirect to dashboard.
  // In a fuller implementation, this could redirect to a /forbidden page.
  void router.navigate(['/dashboard']);
  return false;
};
