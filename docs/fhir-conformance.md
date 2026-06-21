# HL7 FHIR R4 Conformance

> Status: **Phase 1 — placeholder**. Detailed conformance statement lands in Phase 2
> alongside `packages/fhir-types` and `services/fhir-ingestion`.

## Conformance summary

- **FHIR version:** R4 (4.0.1)
- **Resource formats:** JSON only (XML not supported)
- **Validation:** strict by default (`FHIR_VALIDATION_STRICT=true`); performed by
  `services/fhir-ingestion` before persistence.
- **TypeScript types:** `packages/fhir-types` ships hand-curated types for the
  resource subset below (full R4 is too large to ship verbatim).

## Supported resources (initial subset)

| Resource | Used by |
|----------|---------|
| `Patient` | All roles |
| `Practitioner` | Doctor, Nurse, Radiologist, Pharmacist, Lab Tech |
| `Encounter` | Doctor, Nurse, Patient |
| `Appointment` | All clinical roles |
| `Observation` (vitals) | Nurse, Doctor, Patient |
| `DiagnosticReport` | Radiologist, Lab Tech, Doctor |
| `MedicationRequest` | Doctor, Pharmacist |
| `MedicationDispense` | Pharmacist |
| `ServiceRequest` (lab/imaging orders) | Doctor, Lab Tech, Radiologist |
| `Claim` / `ExplanationOfBenefit` | Billing Specialist |
| `AuditEvent` | Auditor, Medical Director |

## Ingestion contract

1. External system POSTs a FHIR `Bundle` to `apps/api` `/fhir` endpoint.
2. Gateway authenticates + authorizes via RBAC guard.
3. Gateway publishes raw bundle to `fhir.resource.ingested` Kafka topic.
4. `services/fhir-ingestion` consumes, validates against R4, persists to
   Postgres `fhir_resources` table (JSONB column), and emits
   `fhir.resource.validated` for downstream consumers (AI, notifications).
5. Validation failures are emitted to `audit.event` with reason codes.
