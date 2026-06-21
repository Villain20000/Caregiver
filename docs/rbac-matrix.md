# RBAC Permission Matrix

> Status: **Phase 1 — placeholder**. The full 10 × 30 grid is populated in Phase 2
> alongside `packages/rbac`.

## Roles (10)

| # | Role key | Display name |
|---|----------|--------------|
| 1 | `admin` | Administrator |
| 2 | `doctor` | Doctor |
| 3 | `nurse` | Nurse |
| 4 | `patient` | Patient |
| 5 | `radiologist` | Radiologist |
| 6 | `pharmacist` | Pharmacist |
| 7 | `billing_specialist` | Billing Specialist |
| 8 | `lab_tech` | Lab Technician |
| 9 | `auditor` | Auditor |
| 10 | `medical_director` | Medical Director |

## Micro-features (30 per role → 300 permission points)

The 30 micro-features span these domains (final list finalized in Phase 2):

- Appointments (schedule, reschedule, cancel, view-by-patient, view-by-clinic)
- Vitals (record, view, trend, threshold-alert-config)
- AI-assisted diagnostics (request, view, approve, override, audit-trail)
- Real-time alerts (subscribe, acknowledge, escalate, mute, route-config)
- FHIR resources (ingest, validate, view, export, search)
- Orders (lab order, imaging order, medication order, fill, dispense)
- Billing (claim create, claim submit, adjudicate, post-payment, denial)
- Audit & compliance (read log, export log, redact-PHI, retain-policy, breach-report)

Each cell of the 10 × 30 matrix is one of: `allow`, `deny`, `conditional`
(e.g. patient can only view their own records). The canonical matrix is
generated from `packages/rbac/src/matrix.ts` in Phase 2 and rendered here.
