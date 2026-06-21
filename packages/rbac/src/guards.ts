/**
 * packages/rbac/src/guards.ts
 *
 * Guard helpers for runtime permission evaluation.
 *
 * These functions are used by:
 *   - NestJS guards in apps/api (REST endpoint protection)
 *   - Socket.io middleware in services/notifications (room access control)
 *   - Angular route guards in apps/web (frontend route protection)
 *
 * The guards read from PERMISSION_MATRIX and evaluate 'conditional'
 * permissions using the PermissionContext (e.g. checking ownership).
 */
import { PERMISSION_MATRIX } from './matrix.js';
import type { Permission, PermissionResult, PermissionContext } from './permission.js';
import type { Role } from './roles.js';
import type { Feature } from './features.js';

/**
 * Check if a role has a specific permission (static check, no conditions).
 * Returns the raw permission value from the matrix.
 *
 * Use this for quick checks that don't need runtime context.
 * For conditional permissions, use `canAccess()` instead.
 *
 * @example
 *   hasPermission('doctor', 'ai.request_diagnosis') // 'allow'
 *   hasPermission('patient', 'appointment.view_by_clinic') // 'deny'
 */
export function hasPermission(role: Role, feature: Feature): Permission {
  return PERMISSION_MATRIX[role][feature];
}

/**
 * Get all permissions for a role as a Feature → Permission map.
 * Useful for frontend dashboard rendering (show/hide widgets based on perms).
 *
 * @example
 *   const perms = getRolePermissions('nurse');
 *   // perms['vitals.record'] === 'allow'
 *   // perms['ai.request_diagnosis'] === 'deny'
 */
export function getRolePermissions(role: Role): Record<Feature, Permission> {
  return PERMISSION_MATRIX[role];
}

/**
 * Get all features a role is allowed to perform (allow or conditional).
 * Useful for building role-specific dashboard navigation.
 *
 * @example
 *   const features = getPermissions('doctor');
 *   // Returns array of features where permission is 'allow' or 'conditional'
 */
export function getPermissions(role: Role): Feature[] {
  const rolePerms = PERMISSION_MATRIX[role];
  return Object.entries(rolePerms)
    .filter(([, perm]) => perm === 'allow' || perm === 'conditional')
    .map(([feature]) => feature as Feature);
}

/**
 * Evaluate a permission at runtime with full context.
 *
 * This is the primary guard function used by NestJS guards and Socket.io
 * middleware. It handles:
 *   1. Static 'allow' → granted immediately
 *   2. Static 'deny' → denied immediately
 *   3. 'conditional' → evaluates the condition using PermissionContext
 *
 * Conditional rules:
 *   - patient role + clinical features → granted only if targetOwnerId === userId
 *     (patients can only access their own records)
 *   - nurse + appointment.view_by_clinic → granted (simplified for now;
 *     full implementation would check clinic assignment)
 *
 * @example
 *   const result = canAccess('patient', 'vitals.view', {
 *     userId: 'p-123', targetOwnerId: 'p-123'
 *   });
 *   // result = { granted: true, reason: 'Own record access' }
 *
 * @example
 *   const result = canAccess('patient', 'vitals.view', {
 *     userId: 'p-123', targetOwnerId: 'p-456'
 *   });
 *   // result = { granted: false, reason: 'Cannot access other patients' records' }
 */
export function canAccess(role: Role, feature: Feature, context: PermissionContext): PermissionResult {
  const permission = PERMISSION_MATRIX[role][feature];

  // Static allow — no condition needed.
  if (permission === 'allow') {
    return { granted: true, reason: `Role '${role}' has allow permission for '${feature}'` };
  }

  // Static deny — no condition can override.
  if (permission === 'deny') {
    return { granted: false, reason: `Role '${role}' is denied '${feature}'` };
  }

  // Conditional — evaluate the runtime condition.
  return evaluateCondition(role, feature, context);
}

/**
 * Evaluate a conditional permission at runtime.
 *
 * This is the heart of the conditional access logic. It checks whether
 * the PermissionContext satisfies the condition for the given role+feature.
 *
 * Current conditions:
 *   - patient role → can only access resources where targetOwnerId === userId
 *   - nurse + view_by_clinic → allowed (simplified; full impl checks assignment)
 *
 * Phase 3 will add:
 *   - Department/clinic assignment checks
 *   - Time-based access (e.g. on-call hours)
 *   - Resource-specific conditions (e.g. encounter status)
 */
function evaluateCondition(role: Role, feature: Feature, context: PermissionContext): PermissionResult {
  // ── Patient: can only access own records ──────────────────
  if (role === 'patient') {
    // If no target owner is specified, deny (can't verify ownership).
    if (!context.targetOwnerId) {
      return {
        granted: false,
        reason: `Patient '${context.userId}' denied '${feature}': no target owner specified for ownership check`,
      };
    }
    // Check if the patient is accessing their own records.
    if (context.targetOwnerId === context.userId) {
      return {
        granted: true,
        reason: `Patient '${context.userId}' accessing own record for '${feature}'`,
      };
    }
    return {
      granted: false,
      reason: `Patient '${context.userId}' denied '${feature}': cannot access other patients' records`,
    };
  }

  // ── Nurse: view_by_clinic is conditional on clinic assignment ──
  if (role === 'nurse' && feature === 'appointment.view_by_clinic') {
    // Simplified: allow if the nurse has any assignment.
    // Full implementation would check context.metadata.clinicId against
    // the nurse's assigned clinics.
    return {
      granted: true,
      reason: `Nurse '${context.userId}' viewing clinic appointments (assignment check simplified)`,
    };
  }

  // ── Default: deny if no condition matches ─────────────────
  return {
    granted: false,
    reason: `No conditional rule matched for role '${role}' + feature '${feature}'`,
  };
}
