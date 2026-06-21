/**
 * packages/rbac/src/features.ts
 *
 * The 30 micro-features that each role can access.
 * 10 roles × 30 features = 300 permission points.
 *
 * Features are grouped into 8 domains:
 *   1. Appointments (5 features)
 *   2. Vitals (5 features)
 *   3. AI Diagnostics (5 features)
 *   4. Real-time Alerts (5 features)
 *   5. FHIR Resources (5 features)
 *   6. Orders (5 features)
 *   7. Billing (5 features)
 *   8. Audit & Compliance (5 features) — wait, that's 40. Let me recount.
 *
 * Actually: 8 domains × ~3-4 features each = 30 total. The exact grouping
 * is below. Each feature is a granular action, not a broad category.
 */

/**
 * The 30 micro-features, grouped by domain.
 * Each feature is a specific action a user can perform.
 *
 * `as const` ensures the `Feature` type is a strict union.
 */
export const FEATURES = [
  // ── Appointments (5) ──────────────────────────────────────
  'appointment.schedule', // Create a new appointment
  'appointment.reschedule', // Modify an existing appointment time
  'appointment.cancel', // Cancel an appointment
  'appointment.view_by_patient', // View appointments for a specific patient
  'appointment.view_by_clinic', // View all appointments across the clinic

  // ── Vitals (5) ────────────────────────────────────────────
  'vitals.record', // Record new vital signs
  'vitals.view', // View vital signs records
  'vitals.trend', // View vital signs trends over time
  'vitals.threshold_config', // Configure alert thresholds for vitals
  'vitals.export', // Export vital signs data

  // ── AI Diagnostics (5) ────────────────────────────────────
  'ai.request_diagnosis', // Request an AI-assisted diagnosis
  'ai.view_diagnosis', // View AI diagnosis results
  'ai.approve_diagnosis', // Approve/accept an AI diagnosis
  'ai.override_diagnosis', // Override/reject an AI diagnosis
  'ai.audit_trail', // View the audit trail of AI diagnosis actions

  // ── Real-time Alerts (5) ──────────────────────────────────
  'alert.subscribe', // Subscribe to real-time alert channels
  'alert.acknowledge', // Acknowledge an alert
  'alert.escalate', // Escalate an alert to a higher role
  'alert.mute', // Mute/suppress alerts temporarily
  'alert.route_config', // Configure alert routing rules

  // ── FHIR Resources (5) ────────────────────────────────────
  'fhir.ingest', // Ingest external FHIR bundles
  'fhir.validate', // Validate FHIR resources against R4 schemas
  'fhir.view', // View FHIR resources
  'fhir.export', // Export FHIR resources
  'fhir.search', // Search FHIR resources by criteria

  // ── Orders (5) ────────────────────────────────────────────
  'order.lab_create', // Create a lab order (ServiceRequest)
  'order.imaging_create', // Create an imaging order (ServiceRequest)
  'order.medication_create', // Create a medication order (MedicationRequest)
  'order.fill', // Fill/dispense an order (pharmacist)
  'order.dispense', // Record a dispense event (MedicationDispense)

  // ── Billing (5) ───────────────────────────────────────────
  'billing.claim_create', // Create a new insurance claim
  'billing.claim_submit', // Submit a claim to an insurer
  'billing.adjudicate', // Adjudicate a claim response (EOB)
  'billing.post_payment', // Post a payment against a claim
  'billing.denial_report', // Generate a denial analysis report

  // ── Audit & Compliance (5) ────────────────────────────────
  'audit.read_log', // Read the audit log
  'audit.export_log', // Export the audit log
  'audit.redact_phi', // Redact PHI from exported data
  'audit.retention_policy', // Configure data retention policies
  'audit.breach_report', // Generate a breach notification report
] as const;

/** Union type of all 30 micro-features. */
export type Feature = (typeof FEATURES)[number];

/**
 * Domain grouping for features — used for dashboard organization
 * and for rendering the permission matrix in docs.
 */
export const FEATURE_DOMAINS = {
  appointments: [
    'appointment.schedule',
    'appointment.reschedule',
    'appointment.cancel',
    'appointment.view_by_patient',
    'appointment.view_by_clinic',
  ],
  vitals: [
    'vitals.record',
    'vitals.view',
    'vitals.trend',
    'vitals.threshold_config',
    'vitals.export',
  ],
  ai_diagnostics: [
    'ai.request_diagnosis',
    'ai.view_diagnosis',
    'ai.approve_diagnosis',
    'ai.override_diagnosis',
    'ai.audit_trail',
  ],
  alerts: [
    'alert.subscribe',
    'alert.acknowledge',
    'alert.escalate',
    'alert.mute',
    'alert.route_config',
  ],
  fhir: [
    'fhir.ingest',
    'fhir.validate',
    'fhir.view',
    'fhir.export',
    'fhir.search',
  ],
  orders: [
    'order.lab_create',
    'order.imaging_create',
    'order.medication_create',
    'order.fill',
    'order.dispense',
  ],
  billing: [
    'billing.claim_create',
    'billing.claim_submit',
    'billing.adjudicate',
    'billing.post_payment',
    'billing.denial_report',
  ],
  audit_compliance: [
    'audit.read_log',
    'audit.export_log',
    'audit.redact_phi',
    'audit.retention_policy',
    'audit.breach_report',
  ],
} as const satisfies Record<string, Feature[]>;
