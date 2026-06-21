/**
 * packages/rbac/src/index.ts
 *
 * Public API for the @caregiver/rbac package.
 *
 * Exports:
 *   - Role enum + type (the 10 healthcare roles)
 *   - Feature enum + type (the 30 micro-features)
 *   - Permission type (allow / deny / conditional)
 *   - PERMISSION_MATRIX (the canonical 10×30 = 300 permission-point grid)
 *   - Guard helpers: hasPermission, canAccess, getPermissions
 *   - Conditional access rules (e.g. patient can only view own records)
 */

// ── Roles ────────────────────────────────────────────────────
export { RBAC_ROLES, type Role } from './roles.js';
export { ROLE_DISPLAY_NAMES } from './roles.js';

// ── Features (the 30 micro-features) ─────────────────────────
export { FEATURES, type Feature } from './features.js';

// ── Permission types ─────────────────────────────────────────
export { type Permission, type PermissionResult, type PermissionContext } from './permission.js';

// ── The canonical permission matrix ──────────────────────────
export { PERMISSION_MATRIX } from './matrix.js';

// ── Guard helpers ────────────────────────────────────────────
export { hasPermission, canAccess, getPermissions, getRolePermissions } from './guards.js';
