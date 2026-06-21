/**
 * packages/rbac/src/permission.ts
 *
 * Permission type definitions for the RBAC system.
 *
 * Each cell in the 10×30 permission matrix is one of:
 *   - 'allow'       → the role can perform the feature unconditionally
 *   - 'deny'        → the role cannot perform the feature
 *   - 'conditional' → the role can perform the feature IF a condition is met
 *                     (e.g. patient can only view their own records)
 *
 * Conditional permissions are evaluated at runtime by the guard helpers
 * in guards.ts, using the PermissionContext (which includes the user's
 * ID, role, and the target resource's owner ID).
 */

/**
 * The three possible permission values for any role×feature combination.
 * - 'allow'       → always permitted
 * - 'deny'        → never permitted
 * - 'conditional' → permitted only if the runtime condition passes
 */
export type Permission = 'allow' | 'deny' | 'conditional';

/**
 * Result of a permission check at runtime.
 * - granted: true if the action is allowed
 * - reason: human-readable explanation (for audit logging)
 */
export interface PermissionResult {
  /** Whether the action is permitted. */
  granted: boolean;
  /** Why the permission was granted or denied (for audit trail). */
  reason: string;
}

/**
 * Runtime context for conditional permission evaluation.
 * Passed to the guard when checking 'conditional' permissions.
 *
 * Example: a patient viewing their own observations:
 *   { userId: 'patient-123', role: 'patient', targetOwnerId: 'patient-123' }
 * → condition passes (own records)
 *
 * Example: a patient viewing another patient's observations:
 *   { userId: 'patient-123', role: 'patient', targetOwnerId: 'patient-456' }
 * → condition fails (not own records)
 */
export interface PermissionContext {
  /** The ID of the user requesting the action. */
  userId: string;
  /** The role of the user requesting the action. */
  role: string;
  /** The ID of the resource owner (for ownership-based conditions). */
  targetOwnerId?: string;
  /** The ID of the target resource (for resource-specific conditions). */
  targetResourceId?: string;
  /** The type of the target resource (e.g. 'Patient', 'Observation'). */
  targetResourceType?: string;
  /** Additional context data for complex conditions. */
  metadata?: Record<string, unknown>;
}
