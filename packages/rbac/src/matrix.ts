/**
 * packages/rbac/src/matrix.ts
 *
 * THE CANONIAL PERMISSION MATRIX — 10 roles × 30 features = 300 permission points.
 *
 * This is the single source of truth for access control across the entire
 * Caregiver platform. Every NestJS guard, Socket.io room check, and frontend
 * route guard reads from this matrix.
 *
 * Permission values:
 *   'allow'       → the role can perform the feature unconditionally
 *   'deny'        → the role cannot perform the feature
 *   'conditional' → the role can perform the feature if a runtime condition passes
 *                   (evaluated by guards.ts using PermissionContext)
 *
 * Conditional rules (evaluated in guards.ts):
 *   - patient + any clinical feature → only if targetOwnerId === userId (own records)
 *   - nurse + view_by_clinic → only if clinic is in their assignment
 *   - auditor + any feature → read-only (never allow write features)
 *
 * Legend for the matrix below:
 *   ✅ = allow    ❌ = deny    🔒 = conditional
 */
import type { Permission } from './permission.js';
import type { Role } from './roles.js';
import type { Feature } from './features.js';

/**
 * The permission matrix: a nested Record mapping Role → Feature → Permission.
 *
 * Type-safe: TypeScript will error if any role or feature is missing,
 * ensuring the matrix is always complete (10×30 = 300 cells).
 */
export const PERMISSION_MATRIX: Record<Role, Record<Feature, Permission>> = {
  // ════════════════════════════════════════════════════════════
  // ADMIN — full access to everything (no clinical limits)
  // ════════════════════════════════════════════════════════════
  admin: {
    // Appointments
    'appointment.schedule': 'allow',
    'appointment.reschedule': 'allow',
    'appointment.cancel': 'allow',
    'appointment.view_by_patient': 'allow',
    'appointment.view_by_clinic': 'allow',
    // Vitals
    'vitals.record': 'allow',
    'vitals.view': 'allow',
    'vitals.trend': 'allow',
    'vitals.threshold_config': 'allow',
    'vitals.export': 'allow',
    // AI Diagnostics
    'ai.request_diagnosis': 'allow',
    'ai.view_diagnosis': 'allow',
    'ai.approve_diagnosis': 'allow',
    'ai.override_diagnosis': 'allow',
    'ai.audit_trail': 'allow',
    // Alerts
    'alert.subscribe': 'allow',
    'alert.acknowledge': 'allow',
    'alert.escalate': 'allow',
    'alert.mute': 'allow',
    'alert.route_config': 'allow',
    // FHIR
    'fhir.ingest': 'allow',
    'fhir.validate': 'allow',
    'fhir.view': 'allow',
    'fhir.export': 'allow',
    'fhir.search': 'allow',
    // Orders
    'order.lab_create': 'allow',
    'order.imaging_create': 'allow',
    'order.medication_create': 'allow',
    'order.fill': 'allow',
    'order.dispense': 'allow',
    // Billing
    'billing.claim_create': 'allow',
    'billing.claim_submit': 'allow',
    'billing.adjudicate': 'allow',
    'billing.post_payment': 'allow',
    'billing.denial_report': 'allow',
    // Audit
    'audit.read_log': 'allow',
    'audit.export_log': 'allow',
    'audit.redact_phi': 'allow',
    'audit.retention_policy': 'allow',
    'audit.breach_report': 'allow',
  },

  // ════════════════════════════════════════════════════════════
  // DOCTOR — diagnose, prescribe, order tests, view all patients
  // ════════════════════════════════════════════════════════════
  doctor: {
    // Appointments — full scheduling access
    'appointment.schedule': 'allow',
    'appointment.reschedule': 'allow',
    'appointment.cancel': 'allow',
    'appointment.view_by_patient': 'allow',
    'appointment.view_by_clinic': 'allow',
    // Vitals — can record and view all
    'vitals.record': 'allow',
    'vitals.view': 'allow',
    'vitals.trend': 'allow',
    'vitals.threshold_config': 'allow',
    'vitals.export': 'allow',
    // AI Diagnostics — can request, view, approve, override
    'ai.request_diagnosis': 'allow',
    'ai.view_diagnosis': 'allow',
    'ai.approve_diagnosis': 'allow',
    'ai.override_diagnosis': 'allow',
    'ai.audit_trail': 'allow',
    // Alerts — can subscribe, acknowledge, escalate (no config)
    'alert.subscribe': 'allow',
    'alert.acknowledge': 'allow',
    'alert.escalate': 'allow',
    'alert.mute': 'deny',
    'alert.route_config': 'deny',
    // FHIR — can view, search, export (no ingest/validate)
    'fhir.ingest': 'deny',
    'fhir.validate': 'deny',
    'fhir.view': 'allow',
    'fhir.export': 'allow',
    'fhir.search': 'allow',
    // Orders — can create all order types (no fill/dispense)
    'order.lab_create': 'allow',
    'order.imaging_create': 'allow',
    'order.medication_create': 'allow',
    'order.fill': 'deny',
    'order.dispense': 'deny',
    // Billing — can create claims (no submit/adjudicate/payment)
    'billing.claim_create': 'allow',
    'billing.claim_submit': 'deny',
    'billing.adjudicate': 'deny',
    'billing.post_payment': 'deny',
    'billing.denial_report': 'deny',
    // Audit — read-only access to audit trail (no config)
    'audit.read_log': 'allow',
    'audit.export_log': 'deny',
    'audit.redact_phi': 'deny',
    'audit.retention_policy': 'deny',
    'audit.breach_report': 'deny',
  },

  // ════════════════════════════════════════════════════════════
  // NURSE — record vitals, administer meds, view assigned patients
  // ════════════════════════════════════════════════════════════
  nurse: {
    // Appointments — can schedule/reschedule/cancel for patients
    'appointment.schedule': 'allow',
    'appointment.reschedule': 'allow',
    'appointment.cancel': 'allow',
    'appointment.view_by_patient': 'allow',
    'appointment.view_by_clinic': 'conditional', // only if clinic is in assignment
    // Vitals — primary vitals recorder
    'vitals.record': 'allow',
    'vitals.view': 'allow',
    'vitals.trend': 'allow',
    'vitals.threshold_config': 'deny',
    'vitals.export': 'allow',
    // AI Diagnostics — can view but not request/approve/override
    'ai.request_diagnosis': 'deny',
    'ai.view_diagnosis': 'allow',
    'ai.approve_diagnosis': 'deny',
    'ai.override_diagnosis': 'deny',
    'ai.audit_trail': 'deny',
    // Alerts — can subscribe, acknowledge, escalate (no config/mute)
    'alert.subscribe': 'allow',
    'alert.acknowledge': 'allow',
    'alert.escalate': 'allow',
    'alert.mute': 'deny',
    'alert.route_config': 'deny',
    // FHIR — can view and search (no ingest/validate/export)
    'fhir.ingest': 'deny',
    'fhir.validate': 'deny',
    'fhir.view': 'allow',
    'fhir.export': 'deny',
    'fhir.search': 'allow',
    // Orders — cannot create orders, can fill/dispense meds
    'order.lab_create': 'deny',
    'order.imaging_create': 'deny',
    'order.medication_create': 'deny',
    'order.fill': 'allow',
    'order.dispense': 'allow',
    // Billing — no billing access
    'billing.claim_create': 'deny',
    'billing.claim_submit': 'deny',
    'billing.adjudicate': 'deny',
    'billing.post_payment': 'deny',
    'billing.denial_report': 'deny',
    // Audit — no audit access
    'audit.read_log': 'deny',
    'audit.export_log': 'deny',
    'audit.redact_phi': 'deny',
    'audit.retention_policy': 'deny',
    'audit.breach_report': 'deny',
  },

  // ════════════════════════════════════════════════════════════
  // PATIENT — view own records only, schedule own appointments
  // All clinical features are 'conditional' (own records only)
  // ════════════════════════════════════════════════════════════
  patient: {
    // Appointments — can schedule/reschedule/cancel own
    'appointment.schedule': 'conditional', // own appointments only
    'appointment.reschedule': 'conditional',
    'appointment.cancel': 'conditional',
    'appointment.view_by_patient': 'conditional', // only own patient ID
    'appointment.view_by_clinic': 'deny',
    // Vitals — can view/export own vitals only
    'vitals.record': 'deny',
    'vitals.view': 'conditional', // own vitals only
    'vitals.trend': 'conditional',
    'vitals.threshold_config': 'deny',
    'vitals.export': 'conditional',
    // AI Diagnostics — can view own diagnoses only
    'ai.request_diagnosis': 'deny',
    'ai.view_diagnosis': 'conditional', // own diagnoses only
    'ai.approve_diagnosis': 'deny',
    'ai.override_diagnosis': 'deny',
    'ai.audit_trail': 'deny',
    // Alerts — can subscribe to own alerts, acknowledge
    'alert.subscribe': 'conditional', // own alerts only
    'alert.acknowledge': 'conditional',
    'alert.escalate': 'deny',
    'alert.mute': 'deny',
    'alert.route_config': 'deny',
    // FHIR — can view/export own resources only
    'fhir.ingest': 'deny',
    'fhir.validate': 'deny',
    'fhir.view': 'conditional', // own resources only
    'fhir.export': 'conditional',
    'fhir.search': 'conditional', // limited to own resources
    // Orders — no order creation
    'order.lab_create': 'deny',
    'order.imaging_create': 'deny',
    'order.medication_create': 'deny',
    'order.fill': 'deny',
    'order.dispense': 'deny',
    // Billing — can view own claims only (via conditional)
    'billing.claim_create': 'deny',
    'billing.claim_submit': 'deny',
    'billing.adjudicate': 'deny',
    'billing.post_payment': 'deny',
    'billing.denial_report': 'deny',
    // Audit — no audit access
    'audit.read_log': 'deny',
    'audit.export_log': 'deny',
    'audit.redact_phi': 'deny',
    'audit.retention_policy': 'deny',
    'audit.breach_report': 'deny',
  },

  // ════════════════════════════════════════════════════════════
  // RADIOLOGIST — read imaging studies, issue diagnostic reports
  // ════════════════════════════════════════════════════════════
  radiologist: {
    // Appointments — can view but not schedule
    'appointment.schedule': 'deny',
    'appointment.reschedule': 'deny',
    'appointment.cancel': 'deny',
    'appointment.view_by_patient': 'allow',
    'appointment.view_by_clinic': 'allow',
    // Vitals — can view (relevant to imaging interpretation)
    'vitals.record': 'deny',
    'vitals.view': 'allow',
    'vitals.trend': 'allow',
    'vitals.threshold_config': 'deny',
    'vitals.export': 'deny',
    // AI Diagnostics — can request (for imaging), view, approve
    'ai.request_diagnosis': 'allow',
    'ai.view_diagnosis': 'allow',
    'ai.approve_diagnosis': 'allow',
    'ai.override_diagnosis': 'allow',
    'ai.audit_trail': 'allow',
    // Alerts — can subscribe, acknowledge (no escalate/mute/config)
    'alert.subscribe': 'allow',
    'alert.acknowledge': 'allow',
    'alert.escalate': 'deny',
    'alert.mute': 'deny',
    'alert.route_config': 'deny',
    // FHIR — can view, search, export (for imaging studies)
    'fhir.ingest': 'deny',
    'fhir.validate': 'deny',
    'fhir.view': 'allow',
    'fhir.export': 'allow',
    'fhir.search': 'allow',
    // Orders — can create imaging orders only
    'order.lab_create': 'deny',
    'order.imaging_create': 'allow',
    'order.medication_create': 'deny',
    'order.fill': 'deny',
    'order.dispense': 'deny',
    // Billing — no billing access
    'billing.claim_create': 'deny',
    'billing.claim_submit': 'deny',
    'billing.adjudicate': 'deny',
    'billing.post_payment': 'deny',
    'billing.denial_report': 'deny',
    // Audit — read-only audit trail
    'audit.read_log': 'allow',
    'audit.export_log': 'deny',
    'audit.redact_phi': 'deny',
    'audit.retention_policy': 'deny',
    'audit.breach_report': 'deny',
  },

  // ════════════════════════════════════════════════════════════
  // PHARMACIST — review/fill prescriptions, manage medication inventory
  // ════════════════════════════════════════════════════════════
  pharmacist: {
    // Appointments — can view but not schedule
    'appointment.schedule': 'deny',
    'appointment.reschedule': 'deny',
    'appointment.cancel': 'deny',
    'appointment.view_by_patient': 'allow',
    'appointment.view_by_clinic': 'allow',
    // Vitals — can view (relevant to medication monitoring)
    'vitals.record': 'deny',
    'vitals.view': 'allow',
    'vitals.trend': 'allow',
    'vitals.threshold_config': 'deny',
    'vitals.export': 'deny',
    // AI Diagnostics — can view (drug interaction alerts)
    'ai.request_diagnosis': 'deny',
    'ai.view_diagnosis': 'allow',
    'ai.approve_diagnosis': 'deny',
    'ai.override_diagnosis': 'deny',
    'ai.audit_trail': 'deny',
    // Alerts — can subscribe, acknowledge (drug alerts)
    'alert.subscribe': 'allow',
    'alert.acknowledge': 'allow',
    'alert.escalate': 'allow',
    'alert.mute': 'deny',
    'alert.route_config': 'deny',
    // FHIR — can view, search (medication resources)
    'fhir.ingest': 'deny',
    'fhir.validate': 'deny',
    'fhir.view': 'allow',
    'fhir.export': 'deny',
    'fhir.search': 'allow',
    // Orders — can fill and dispense medication orders
    'order.lab_create': 'deny',
    'order.imaging_create': 'deny',
    'order.medication_create': 'allow', // can create in some contexts
    'order.fill': 'allow',
    'order.dispense': 'allow',
    // Billing — can create claims for medication billing
    'billing.claim_create': 'allow',
    'billing.claim_submit': 'deny',
    'billing.adjudicate': 'deny',
    'billing.post_payment': 'deny',
    'billing.denial_report': 'deny',
    // Audit — read-only audit trail
    'audit.read_log': 'allow',
    'audit.export_log': 'deny',
    'audit.redact_phi': 'deny',
    'audit.retention_policy': 'deny',
    'audit.breach_report': 'deny',
  },

  // ════════════════════════════════════════════════════════════
  // BILLING SPECIALIST — create claims, submit to insurers, post payments
  // ════════════════════════════════════════════════════════════
  billing_specialist: {
    // Appointments — can view (for billing context)
    'appointment.schedule': 'deny',
    'appointment.reschedule': 'deny',
    'appointment.cancel': 'deny',
    'appointment.view_by_patient': 'allow',
    'appointment.view_by_clinic': 'allow',
    // Vitals — no access (not relevant to billing)
    'vitals.record': 'deny',
    'vitals.view': 'deny',
    'vitals.trend': 'deny',
    'vitals.threshold_config': 'deny',
    'vitals.export': 'deny',
    // AI Diagnostics — no access
    'ai.request_diagnosis': 'deny',
    'ai.view_diagnosis': 'deny',
    'ai.approve_diagnosis': 'deny',
    'ai.override_diagnosis': 'deny',
    'ai.audit_trail': 'deny',
    // Alerts — can subscribe to billing alerts
    'alert.subscribe': 'allow',
    'alert.acknowledge': 'allow',
    'alert.escalate': 'deny',
    'alert.mute': 'deny',
    'alert.route_config': 'deny',
    // FHIR — can view, search, export (Claim, EOB resources)
    'fhir.ingest': 'deny',
    'fhir.validate': 'deny',
    'fhir.view': 'allow',
    'fhir.export': 'allow',
    'fhir.search': 'allow',
    // Orders — no order creation
    'order.lab_create': 'deny',
    'order.imaging_create': 'deny',
    'order.medication_create': 'deny',
    'order.fill': 'deny',
    'order.dispense': 'deny',
    // Billing — full billing access
    'billing.claim_create': 'allow',
    'billing.claim_submit': 'allow',
    'billing.adjudicate': 'allow',
    'billing.post_payment': 'allow',
    'billing.denial_report': 'allow',
    // Audit — read-only audit trail (for billing compliance)
    'audit.read_log': 'allow',
    'audit.export_log': 'allow',
    'audit.redact_phi': 'allow',
    'audit.retention_policy': 'deny',
    'audit.breach_report': 'deny',
  },

  // ════════════════════════════════════════════════════════════
  // LAB TECH — process lab orders, record results
  // ════════════════════════════════════════════════════════════
  lab_tech: {
    // Appointments — can view (for lab scheduling context)
    'appointment.schedule': 'deny',
    'appointment.reschedule': 'deny',
    'appointment.cancel': 'deny',
    'appointment.view_by_patient': 'allow',
    'appointment.view_by_clinic': 'deny',
    // Vitals — can view lab-related vitals
    'vitals.record': 'allow', // can record lab results as observations
    'vitals.view': 'allow',
    'vitals.trend': 'allow',
    'vitals.threshold_config': 'deny',
    'vitals.export': 'allow',
    // AI Diagnostics — can view (lab result interpretation)
    'ai.request_diagnosis': 'deny',
    'ai.view_diagnosis': 'allow',
    'ai.approve_diagnosis': 'deny',
    'ai.override_diagnosis': 'deny',
    'ai.audit_trail': 'deny',
    // Alerts — can subscribe to lab alerts (critical values)
    'alert.subscribe': 'allow',
    'alert.acknowledge': 'allow',
    'alert.escalate': 'allow',
    'alert.mute': 'deny',
    'alert.route_config': 'deny',
    // FHIR — can view, search (lab resources)
    'fhir.ingest': 'deny',
    'fhir.validate': 'deny',
    'fhir.view': 'allow',
    'fhir.export': 'deny',
    'fhir.search': 'allow',
    // Orders — can create lab orders (in some workflows)
    'order.lab_create': 'allow',
    'order.imaging_create': 'deny',
    'order.medication_create': 'deny',
    'order.fill': 'deny',
    'order.dispense': 'deny',
    // Billing — no billing access
    'billing.claim_create': 'deny',
    'billing.claim_submit': 'deny',
    'billing.adjudicate': 'deny',
    'billing.post_payment': 'deny',
    'billing.denial_report': 'deny',
    // Audit — read-only audit trail
    'audit.read_log': 'allow',
    'audit.export_log': 'deny',
    'audit.redact_phi': 'deny',
    'audit.retention_policy': 'deny',
    'audit.breach_report': 'deny',
  },

  // ════════════════════════════════════════════════════════════
  // AUDITOR — read-only access to all data + audit logs
  // Never has write access to any feature
  // ════════════════════════════════════════════════════════════
  auditor: {
    // Appointments — read-only
    'appointment.schedule': 'deny',
    'appointment.reschedule': 'deny',
    'appointment.cancel': 'deny',
    'appointment.view_by_patient': 'allow',
    'appointment.view_by_clinic': 'allow',
    // Vitals — read-only
    'vitals.record': 'deny',
    'vitals.view': 'allow',
    'vitals.trend': 'allow',
    'vitals.threshold_config': 'deny',
    'vitals.export': 'allow',
    // AI Diagnostics — read-only (audit trail is key)
    'ai.request_diagnosis': 'deny',
    'ai.view_diagnosis': 'allow',
    'ai.approve_diagnosis': 'deny',
    'ai.override_diagnosis': 'deny',
    'ai.audit_trail': 'allow',
    // Alerts — can subscribe and view (no actions)
    'alert.subscribe': 'allow',
    'alert.acknowledge': 'deny',
    'alert.escalate': 'deny',
    'alert.mute': 'deny',
    'alert.route_config': 'deny',
    // FHIR — read-only
    'fhir.ingest': 'deny',
    'fhir.validate': 'deny',
    'fhir.view': 'allow',
    'fhir.export': 'allow',
    'fhir.search': 'allow',
    // Orders — read-only
    'order.lab_create': 'deny',
    'order.imaging_create': 'deny',
    'order.medication_create': 'deny',
    'order.fill': 'deny',
    'order.dispense': 'deny',
    // Billing — read-only
    'billing.claim_create': 'deny',
    'billing.claim_submit': 'deny',
    'billing.adjudicate': 'deny',
    'billing.post_payment': 'deny',
    'billing.denial_report': 'allow',
    // Audit — full audit access (read, export, redact, report)
    'audit.read_log': 'allow',
    'audit.export_log': 'allow',
    'audit.redact_phi': 'allow',
    'audit.retention_policy': 'allow',
    'audit.breach_report': 'allow',
  },

  // ════════════════════════════════════════════════════════════
  // MEDICAL DIRECTOR — oversight, approve AI diagnoses, quality reports
  // Similar to doctor but with additional audit/oversight powers
  // ════════════════════════════════════════════════════════════
  medical_director: {
    // Appointments — full access (oversight)
    'appointment.schedule': 'allow',
    'appointment.reschedule': 'allow',
    'appointment.cancel': 'allow',
    'appointment.view_by_patient': 'allow',
    'appointment.view_by_clinic': 'allow',
    // Vitals — full access
    'vitals.record': 'allow',
    'vitals.view': 'allow',
    'vitals.trend': 'allow',
    'vitals.threshold_config': 'allow',
    'vitals.export': 'allow',
    // AI Diagnostics — full access (approves AI diagnoses)
    'ai.request_diagnosis': 'allow',
    'ai.view_diagnosis': 'allow',
    'ai.approve_diagnosis': 'allow',
    'ai.override_diagnosis': 'allow',
    'ai.audit_trail': 'allow',
    // Alerts — full access including config
    'alert.subscribe': 'allow',
    'alert.acknowledge': 'allow',
    'alert.escalate': 'allow',
    'alert.mute': 'allow',
    'alert.route_config': 'allow',
    // FHIR — full access including ingest/validate
    'fhir.ingest': 'allow',
    'fhir.validate': 'allow',
    'fhir.view': 'allow',
    'fhir.export': 'allow',
    'fhir.search': 'allow',
    // Orders — full access
    'order.lab_create': 'allow',
    'order.imaging_create': 'allow',
    'order.medication_create': 'allow',
    'order.fill': 'allow',
    'order.dispense': 'allow',
    // Billing — oversight access (can view but not submit)
    'billing.claim_create': 'allow',
    'billing.claim_submit': 'deny',
    'billing.adjudicate': 'allow',
    'billing.post_payment': 'deny',
    'billing.denial_report': 'allow',
    // Audit — full audit access (oversight role)
    'audit.read_log': 'allow',
    'audit.export_log': 'allow',
    'audit.redact_phi': 'allow',
    'audit.retention_policy': 'allow',
    'audit.breach_report': 'allow',
  },
};
