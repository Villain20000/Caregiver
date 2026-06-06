export enum Role {
  PATIENT = 'patient',
  FAMILY = 'family',
  NURSE = 'nurse',
  THERAPIST = 'therapist',
  DOCTOR = 'doctor',
  SOCIAL_WORKER = 'social',
  DISPATCHER = 'dispatcher',
  NUTRITIONIST = 'nutritionist',
  ADMIN = 'admin',
  BILLING = 'billing',
}

export const ROLE_LABELS: Record<Role, string> = {
  [Role.PATIENT]: 'Care Receiver',
  [Role.FAMILY]: 'Family Caregiver',
  [Role.NURSE]: 'Nurse / Medic',
  [Role.THERAPIST]: 'Therapist',
  [Role.DOCTOR]: 'Physician',
  [Role.SOCIAL_WORKER]: 'Social Worker',
  [Role.DISPATCHER]: 'Dispatcher',
  [Role.NUTRITIONIST]: 'Nutritionist',
  [Role.ADMIN]: 'Ops Admin',
  [Role.BILLING]: 'Billing Auditor',
};

export const ROLE_COLORS: Record<Role, string> = {
  [Role.PATIENT]: 'from-sky-500 to-cyan-500',
  [Role.FAMILY]: 'from-pink-500 to-rose-500',
  [Role.NURSE]: 'from-emerald-500 to-teal-500',
  [Role.THERAPIST]: 'from-violet-500 to-fuchsia-500',
  [Role.DOCTOR]: 'from-indigo-500 to-blue-500',
  [Role.SOCIAL_WORKER]: 'from-amber-500 to-orange-500',
  [Role.DISPATCHER]: 'from-yellow-500 to-amber-500',
  [Role.NUTRITIONIST]: 'from-lime-500 to-green-500',
  [Role.ADMIN]: 'from-slate-500 to-slate-700',
  [Role.BILLING]: 'from-fuchsia-500 to-purple-600',
};

export const ROLE_BADGE: Record<Role, string> = {
  [Role.PATIENT]: 'bg-sky-500/15 text-sky-300 ring-sky-400/30',
  [Role.FAMILY]: 'bg-pink-500/15 text-pink-300 ring-pink-400/30',
  [Role.NURSE]: 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/30',
  [Role.THERAPIST]: 'bg-violet-500/15 text-violet-300 ring-violet-400/30',
  [Role.DOCTOR]: 'bg-indigo-500/15 text-indigo-300 ring-indigo-400/30',
  [Role.SOCIAL_WORKER]: 'bg-amber-500/15 text-amber-300 ring-amber-400/30',
  [Role.DISPATCHER]: 'bg-yellow-500/15 text-yellow-300 ring-yellow-400/30',
  [Role.NUTRITIONIST]: 'bg-lime-500/15 text-lime-300 ring-lime-400/30',
  [Role.ADMIN]: 'bg-slate-500/15 text-slate-200 ring-slate-400/30',
  [Role.BILLING]: 'bg-fuchsia-500/15 text-fuchsia-300 ring-fuchsia-400/30',
};

export const ALL_ROLES: readonly Role[] = Object.values(Role);

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  [Role.PATIENT]: 'Receives care. Sees their own schedule, vitals, and care team.',
  [Role.FAMILY]: 'Loved-ones of a care receiver. Sees updates, photos, and messages.',
  [Role.NURSE]: 'Frontline clinician. Owns vitals, medication pass, wound care, and notes.',
  [Role.THERAPIST]: 'PT / OT / SLP. Runs therapy sessions and progress assessments.',
  [Role.DOCTOR]: 'Physician. Approves care plans, reviews clinical charts, signs orders.',
  [Role.SOCIAL_WORKER]: 'Coordinates benefits, family dynamics, and community resources.',
  [Role.DISPATCHER]: 'Routes visits, manages on-call rotations and live GPS.',
  [Role.NUTRITIONIST]: 'Owns meal plans, dietary restrictions, and intake tracking.',
  [Role.ADMIN]: 'Agency operations, staffing, contracts, and configuration.',
  [Role.BILLING]: 'Claims, invoices, timesheets, and audit reconciliation.',
};
