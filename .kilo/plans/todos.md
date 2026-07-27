# Caregiver Implementation Todos

This file tracks the remaining implementation work for the Caregiver platform.

## Completed

- [x] Design page structure, forms, tables, and RBAC checks for fhir, orders, billing, audit pages
- [x] Implement the FHIR Resources page with search, list, ingest, and JSON viewer
- [x] Implement the Orders page with forms for lab/imaging/medication and fill/dispense actions
- [x] Implement the Billing & Claims page with create/submit/adjudicate/payment flows
- [x] Implement the Audit Trail page with filterable log table
- [x] Run web typecheck and review changes

## In Progress

_None at the moment._

## Backlog / Next Steps

- Replace the billing prompt-based adjudication/payment flows with inline forms
- Add unit tests for the new Angular page components
- Implement an RBAC route guard so restricted pages are protected from direct URL access
