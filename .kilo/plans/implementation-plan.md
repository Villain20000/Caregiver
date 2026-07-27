# Missing Features Implementation Plan

## Analysis Summary

The Caregiver healthcare platform is in Phase 1-2 development with core scaffolding in place. The RBAC matrix (10 roles × 8 domains = 40 features) and database schema are complete. Core services (API gateway, fhir-ingestion, ai-rag, notifications, audit) have entry points and basic structure.

### Currently Implemented
- **packages/rbac**: Full permission matrix, guards, role types
- **packages/db**: Complete Drizzle schema (users, appointments, vitals, ai_diagnoses, alerts, audit_log, fhir_resources)
- **packages/kafka**: Typed producer/consumer, topic registry
- **packages/contracts**: DTOs for auth, appointments, vitals, ai-diagnosis; event payloads
- **apps/api**: Auth module, vitals module, appointments module, ai module, alerts gateway (Socket.io)
- **apps/web**: Login page, dashboard, appointments page, vitals page, ai-diagnosis page
- **services/fhir-ingestion**: Validation, persistence, Kafka consumer
- **services/ai-rag**: RAG pipeline with Chroma + Ollama
- **services/notifications**: Alert service, threshold service, consumers

### Missing Features by Category

## 1. FHIR Ingestion Missing Features

**Missing Endpoints/Functionality:**
- `POST /api/fhir` endpoint in API gateway to accept external FHIR bundles
- FHIR controller in API gateway to expose ingest/validate endpoints
- FHIR module in API gateway to wire up fhir controller with Kafka producer

**Dependencies:**
- `packages/contracts/src/events/fhir-events.ts` exists but needs fhir-ingestion contract types
- `packages/kafka/src/producer.ts` and `consumer.ts` provide the foundation

## 2. Orders Module Missing Features

**Missing Components:**
- Orders module in API gateway (`apps/api/src/orders/`)
- Orders controller with endpoints:
  - `POST /api/orders/lab` - Create lab order (ServiceRequest)
  - `POST /api/orders/imaging` - Create imaging order
  - `POST /api/orders/medication` - Create medication order
  - `POST /api/orders/:id/fill` - Fill an order
  - `POST /api/orders/:id/dispense` - Record dispense
- Orders service in API gateway
- `packages/contracts/src/dto/order.dto.ts` - DTO definitions
- Order events in `packages/contracts/src/events/order-events.ts`
- Lab tech and pharmacist role handling for order workflows

## 3. Billing Module Missing Features

**Missing Components:**
- Billing module in API gateway (`apps/api/src/billing/`)
- Billing controller with endpoints:
  - `POST /api/billing/claims` - Create claim
  - `POST /api/billing/claims/:id/submit` - Submit claim
  - `POST /api/billing/adjudicate` - Adjudicate claim response (EOB)
  - `POST /api/billing/payments` - Post payment
- Billing service in API gateway
- Billing DTOs in `packages/contracts/src/dto/billing.dto.ts`
- Billing events in `packages/contracts/src/events/billing-events.ts`

## 4. Audit Module Missing Features

**Missing Components:**
- Audit controller in API gateway to expose audit queries
- `GET /api/audit` - Search/filter audit log
- `GET /api/audit/export` - Export audit log (CSV/PDF)
- `POST /api/audit/redact` - Redact PHI from data
- `POST /api/audit/breach` - Report breach
- `packages/contracts/src/dto/audit.dto.ts`
- `packages/contracts/src/events/audit-events.ts` (currently has AuditEventPayload but needs query DTOs)

## 5. Notifications Service Gaps

**Missing Functionality:**
- Internal endpoint for API gateway to forward alerts to Socket.io
- Or Redis pub/sub integration between notifications and API gateway
- Alert acknowledgment persistence (currently incomplete in alerts.gateway.ts)
- Alert escalation handling

## 6. Angular Frontend Pages Missing

**Missing Pages/Routes:**
- Orders page (`/orders`) - Lab/imaging/medication order management
- Billing page (`/billing`) - Claims, adjudication, payment management
- Audit page (`/audit`) - Audit trail viewing and compliance tools
- FHIR viewer page (`/fhir`) - FHIR resource browsing/search

**Missing Services:**
- Alert acknowledgment service (connects to Socket.io)
- FHIR service - query FHIR resources
- Order service - manage orders
- Billing service - manage billing
- Audit service - query audit logs

## 7. FHIR Types Package Gaps

**Missing Types:**
- Full FHIR R4 resource type definitions in `packages/fhir-types/src/resources/`
- Currently has: patient, observation, encounter, appointment, diagnostic-report, medication-request, medication-dispense, service-request, claim, explanation-of-benefit, audit-event, practitioner
- Missing: Bundle, Organization, Location, Condition, Medication, etc. (full R4 profile)

## 8. Security Gaps

**Missing Features:**
- Password hashing with bcrypt (currently plaintext comparison in auth.service.ts)
- Refresh token rotation and revocation
- Session management for Socket.io connections

## Implementation Priority

### Phase 2 (Core MVP)
1. **API Gateway: FHIR Endpoints**
   - Create `apps/api/src/fhir/` module
   - Add `POST /api/fhir` endpoint to ingest FHIR bundles
   - Add `GET /api/fhir/:resourceType/:id` endpoint to view resources

2. **Web: FHIR Viewer Page**
   - Create `apps/web/src/app/pages/fhir.component.ts`
   - Add route `/fhir` to app.routes.ts
   - Create FHIR service for API calls

3. **Audit Query Service**
   - Add `apps/api/src/audit/` module (thin BFF wrapper)
   - Expose audit.event consumption results via query endpoints

### Phase 3 (Extended Roles)
4. **Orders Module**
   - Orders module + controller + service in API gateway
   - Orders page in web frontend

5. **Billing Module**
   - Billing module + controller + service in API gateway
   - Billing page in web frontend

6. **Alert Acknowledgment Persistence**
   - Connect Socket.io acknowledgment to DB update

7. **Password Hashing**
   - Replace plaintext password check with bcrypt

8. **Missing DTOs/Events**
   - order.dto.ts, billing.dto.ts, audit.dto.ts
   - order-events.ts, billing-events.ts

## Key Decisions Needed

1. **Notifications → Gateway communication**: Should the notifications service call an internal HTTP endpoint on the API gateway, or should we add Redis pub/sub for decoupled alert forwarding?

2. **Audit endpoint location**: Should audit queries be in the API gateway (requiring DB access) or should the audit service expose its own read endpoint?

3. **FHIR resource completeness**: Do we need all 100+ R4 resource types, or just the core 10 currently referenced?

4. **Orders workflow**: Should lab/imaging orders use FHIR ServiceRequest resources directly, or a simplified internal model?

5. **Billing model**: Should we use FHIR Claim/ExplanationOfBenefit resources, or a simplified billing model?

6. **UI component library**: The `packages/ui` exists but is empty. Should we build reusable components (role-badge, vital-chart, diagnosis-card) before the pages, or inline them?

---

**Next Step:** Confirm which Phase 2 features to implement first and answer the key decisions above.