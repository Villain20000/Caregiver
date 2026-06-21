# Architecture

> Status: **Phase 1 — skeleton**. Detailed diagrams land alongside Phase 2 implementation.

## High-level topology

```
                ┌──────────────────────────────────────────────┐
                │                  Browser                      │
                │   Angular 17+ standalone + signals (apps/web) │
                └───────────────┬──────────────────────────────┘
                                │ REST + Socket.io (WebSocket)
                                ▼
                ┌──────────────────────────────────────────────┐
                │   API Gateway (apps/api) — NestJS + Fastify    │
                │   Auth, RBAC guards, BFF, Socket.io namespace │
                └────┬───────────┬───────────┬───────────┬──────┘
                     │           │           │           │
                  Kafka       Kafka       Kafka       Kafka
                     │           │           │           │
        ┌────────────▼──┐ ┌──────▼─────┐ ┌───▼──────┐ ┌──▼─────────┐
        │ fhir-         │ │ ai-rag     │ │ notif-   │ │ audit      │
        │ ingestion     │ │ LangChain  │ │ ications │ │ (append-   │
        │ (FHIR R4)     │ │ Chroma+    │ │ Socket.io│ │  only log) │
        │               │ │ Ollama     │ │ rooms    │ │            │
        └────┬──────────┘ └────┬───────┘ └──────────┘ └────┬───────┘
             │                 │                          │
             ▼                 ▼                          ▼
        ┌──────────────────────────────────────────────────────┐
        │  PostgreSQL 16 + pgvector      ChromaDB    Ollama     │
        │  (Drizzle ORM, packages/db)    (vectors)   (Llama-3)  │
        └──────────────────────────────────────────────────────┘
                             ▲
                             │
                       Apache Kafka
                  (event bus, all services)
```

## Principles

1. **Event-driven.** Cross-service communication flows through Kafka topics;
   only the API gateway holds synchronous REST/Socket.io connections to the
   frontend. No service calls another service directly.
2. **Bounded contexts.** Each microservice owns its tables (no shared writes)
   and emits events others can subscribe to. `packages/db` exposes the Drizzle
   client + schema; per-service schemas are namespaced.
3. **FHIR-first.** All clinical payloads are HL7 FHIR R4 JSON. `packages/fhir-types`
   is the single source of truth for resource shapes; `services/fhir-ingestion`
   validates and persists them.
4. **RBAC at the edge.** The 10-role × 30-feature permission matrix lives in
   `packages/rbac` and is enforced by NestJS guards in `apps/api` plus
   Socket.io room membership in `services/notifications`.
5. **AI is a service, not a layer.** `services/ai-rag` is the only component
   that talks to ChromaDB and Ollama. Diagnosis requests enter via Kafka and
   results return via Kafka — no LLM calls on the request path.
6. **Audit by construction.** Every state-changing event is mirrored to the
   `audit.event` topic and consumed append-only by `services/audit`.

## Workspaces

| Path | Type | Responsibility |
|------|------|----------------|
| `apps/web` | Angular SPA | Role dashboards, real-time alerts, FHIR viewers |
| `apps/api` | NestJS gateway | Auth, RBAC, REST, Socket.io, Kafka producer |
| `services/fhir-ingestion` | Microservice | FHIR R4 ingest + validation |
| `services/ai-rag` | Microservice | LangChain RAG over ChromaDB + Ollama |
| `services/notifications` | Microservice | Real-time alert fan-out |
| `services/audit` | Microservice | Immutable audit log |
| `packages/contracts` | Shared lib | Event schemas, DTOs |
| `packages/fhir-types` | Shared lib | HL7 FHIR R4 TS types |
| `packages/rbac` | Shared lib | Roles, permissions, guards |
| `packages/db` | Shared lib | Drizzle schema + migrations |
| `packages/kafka` | Shared lib | KafkaJS client + topic registry |
| `packages/ui` | Shared lib | Angular component library |
| `packages/config` | Shared lib | Shared TS/ESLint/Prettier config |

## Phasing

- **Phase 1 (this commit):** monorepo skeleton, root + per-workspace config,
  Docker compose, CI stubs, docs stubs. No application code.
- **Phase 2:** `packages/fhir-types` (R4 types), `packages/rbac` (10×30 matrix),
  `packages/db` (Drizzle schema + first migration), NestJS gateway bootstrap,
  Angular app bootstrap, one end-to-end role flow.
- **Phase 3:** remaining microservices, Kafka wiring, RAG pipeline, Playwright
  visual regression suite, deployment target selection.
