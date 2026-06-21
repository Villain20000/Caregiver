/**
 * packages/rbac/src/roles.ts
 *
 * The 10 healthcare roles supported by the Caregiver platform.
 *
 * This `as const` array is the canonical source of truth for roles.
 * The `Role` type is derived from it, so adding a role here automatically
 * updates all types across the monorepo.
 *
 * Role descriptions:
 *   admin              — System administrator (full access, no clinical limits)
 *   doctor             — Physician (diagnose, prescribe, order tests, view all patients)
 *   nurse              — Nurse (record vitals, administer meds, view assigned patients)
 *   patient            — Patient (view own records only, schedule appointments)
 *   radiologist        — Radiologist (read imaging studies, issue diagnostic reports)
 *   pharmacist         — Pharmacist (review/fill prescriptions, manage medication inventory)
 *   billing_specialist — Billing Specialist (create claims, submit to insurers, post payments)
 *   lab_tech           — Lab Technician (process lab orders, record results)
 *   auditor            — Auditor (read-only access to all data + audit logs)
 *   medical_director   — Medical Director (oversight, approve AI diagnoses, quality reports)
 */

/**
 * The 10 healthcare roles, as a const tuple.
 * Order matters only for display; the matrix is keyed by role string.
 */
export const RBAC_ROLES = [
  'admin',
  'doctor',
  'nurse',
  'patient',
  'radiologist',
  'pharmacist',
  'billing_specialist',
  'lab_tech',
  'auditor',
  'medical_director',
] as const;

/** Union type of all valid healthcare roles. */
export type Role = (typeof RBAC_ROLES)[number];

/**
 * Human-readable display names for each role.
 * Used by the Angular role-badge component and dashboard headers.
 */
export const ROLE_DISPLAY_NAMES: Record<Role, string> = {
  admin: 'Administrator',
  doctor: 'Doctor',
  nurse: 'Nurse',
  patient: 'Patient',
  radiologist: 'Radiologist',
  pharmacist: 'Pharmacist',
  billing_specialist: 'Billing Specialist',
  lab_tech: 'Lab Technician',
  auditor: 'Auditor',
  medical_director: 'Medical Director',
};
