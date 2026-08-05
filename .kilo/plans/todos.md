# Caregiver Implementation Todos

This file tracks the remaining implementation work for the Caregiver platform.

## Completed

- [x] Design page structure, forms, tables, and RBAC checks for fhir, orders, billing, audit pages
- [x] Implement the FHIR Resources page with search, list, ingest, and JSON viewer
- [x] Implement the Orders page with forms for lab/imaging/medication and fill/dispense actions
- [x] Implement the Billing & Claims page with create/submit/adjudicate/payment flows
- [x] Implement the Audit Trail page with filterable log table
- [x] Replace the billing prompt-based adjudication/payment flows with inline forms
- [x] Implement an RBAC route guard so restricted pages are protected from direct URL access
- [x] Persist recently-viewed patients (in addition to pinned favorites) to localStorage
- [x] Add role-specific dashboard quick actions + role insight strip (RBAC-gated)
- [x] Wire the real-time alert pipeline: API gateway `alert.dispatched` Kafka consumer → Socket.io gateway
- [x] Add alert escalation sweeper in the notifications service (unacknowledged critical/emergency → emergency re-dispatch, wider roles)
- [x] Add `escalated` flag to the alert contract + distinct escalated UI in the alert bar
- [x] Unit tests: escalation.service.spec.ts + alert-consumer.service.spec.ts
- [x] Docs: developer-guide.md sections 14 (favorites), 15 (dashboard quick actions), 16 (alert lifecycle)
- [x] Expose alert acknowledgment/escalation state via an API endpoint for auditing (GET /api/alerts, /patient/:id, /summary)
- [x] Persist alert acknowledgments into the notifications service flow — gateway now emits `alert.acknowledged`; AckConsumerService persists + audits
- [x] Unit tests: dashboard quick actions + favorites persistence (Karma + Jasmine)
- [x] Unit tests: orders, billing, fhir, and audit page components (Karma + Jasmine)
- [x] Unit tests: app shell favorites bar — chips render, pin/unpin, empty state (Karma + Jasmine)
- [x] Unit tests: order-imaging + order-medication form components (Karma + Jasmine)
- [x] Unit tests: billing-create-claim form component — line items, emit, netAmount (Karma + Jasmine)
- [x] Enforce a coverage floor in CI — karma-coverage `check` thresholds (80% lines/statements, 70% branches/functions), `--code-coverage` in the web test script, drop `continue-on-error` on CI unit tests
- [x] Unit tests: fhir-search component — search/ingest emit, validation, ingestResult reset (Karma + Jasmine)
- [x] Unit tests: API service layer — order, billing, fhir, audit (HttpClient-spy) + alert (socket lifecycle) (Karma + Jasmine)

## In Progress

_None at the moment._

## Backlog / Next Steps

- Add unit tests for the remaining Angular page components (vitals, appointments)
