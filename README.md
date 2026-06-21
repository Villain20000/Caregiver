# Caregiver — Healthcare Intelligence Platform

An enterprise-grade, event-driven, FHIR-compliant healthcare platform with
AI-augmented diagnostics, real-time alerts, and role-based access control
across 10 distinct healthcare roles.

> **Status: Phase 1 — monorepo skeleton.** Workspace structure, root config,
> Docker orchestration, and CI stubs are in place. Application code lands in
> Phase 2 onward. See [`docs/architecture.md`](docs/architecture.md).

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Angular 17+ (standalone components, signals, SCSS, Tailwind) |
| API Gateway | NestJS 10 on Fastify + Socket.io |
| Microservices | NestJS / Fastify workers (4 services) |
| Database | PostgreSQL 16 + pgvector, Drizzle ORM |
| Event streaming | Apache Kafka (via KafkaJS) |
| Real-time | Socket.io (role-based rooms) |
| AI / RAG | LangChain, ChromaDB, Ollama (Llama-3-8B, local) |
| Standards | HL7 FHIR R4 (JSON) |
| DevOps | Docker multi-container, GitHub Actions, Playwright |
| Monorepo | npm workspaces |

## Monorepo layout

```
Caregiver/
├── apps/
│   ├── web/                      # Angular 17+ SPA
│   └── api/                      # NestJS API gateway (BFF)
├── services/
│   ├── fhir-ingestion/           # FHIR R4 ingest + validation
│   ├── ai-rag/                   # LangChain RAG (ChromaDB + Ollama)
│   ├── notifications/            # Real-time alert fan-out
│   └── audit/                    # Append-only audit log
├── packages/
│   ├── contracts/                # Event schemas, DTOs
│   ├── fhir-types/               # HL7 FHIR R4 TS types
│   ├── rbac/                     # 10 roles × 30 features
│   ├── db/                       # Drizzle schema + migrations
│   ├── kafka/                    # KafkaJS client + topic registry
│   ├── ui/                       # Angular component library
│   └── config/                   # Shared TS/ESLint/Prettier
├── docker/                       # docker-compose.yml + Dockerfiles
├── .github/workflows/            # ci.yml, e2e.yml, deploy.yml
├── e2e/                          # Playwright tests
└── docs/                         # architecture, rbac-matrix, fhir-conformance
```

## Quickstart (local dev)

```bash
# 1. Use the pinned Node version
nvm use              # reads .nvmrc (Node 20.11)

# 2. Copy env template
cp .env.example .env

# 3. Install all workspaces
npm install

# 4. Bring up infra (Postgres, Kafka, Chroma, Ollama)
npm run docker:up

# 5. (one-time) pull the Llama-3-8B model into Ollama
docker exec caregiver-ollama ollama pull llama3:8b
docker exec caregiver-ollama ollama pull nomic-embed-text

# 6. Run DB migrations (Phase 2 — Drizzle)
# npm run db:migrate

# 7. Start all apps + services concurrently
npm run dev
```

| Service | URL |
|---------|-----|
| Web (Angular) | http://localhost:4200 |
| API gateway | http://localhost:3000 |
| FHIR ingestion | http://localhost:4001 |
| AI RAG | http://localhost:4002 |
| Notifications | http://localhost:4003 |
| Audit | http://localhost:4004 |
| Postgres | localhost:5432 |
| Kafka | localhost:9092 |
| ChromaDB | http://localhost:8000 |
| Ollama | http://localhost:11434 |

## Useful scripts

```bash
npm run lint            # ESLint across all workspaces
npm run typecheck       # tsc --noEmit across all workspaces
npm run test            # unit tests (vitest / ng test)
npm run test:e2e        # Playwright
npm run docker:up       # start infra containers
npm run docker:down     # stop infra containers
npm run docker:logs     # tail infra logs
npm run db:generate     # Drizzle migration generate
npm run db:migrate      # Drizzle migration apply
npm run db:studio       # Drizzle Studio GUI
```

## Architecture

See [`docs/architecture.md`](docs/architecture.md) for the full topology,
service responsibilities, and phasing plan.

## RBAC

10 roles × 30 micro-features = 300 permission points. The canonical matrix
lives in `packages/rbac` and is documented in [`docs/rbac-matrix.md`](docs/rbac-matrix.md).

## FHIR conformance

HL7 FHIR R4 (JSON only). See [`docs/fhir-conformance.md`](docs/fhir-conformance.md).

## Phasing

- **Phase 1 (current):** monorepo skeleton, root + per-workspace config, Docker
  compose, CI stubs, docs stubs. No application code.
- **Phase 2:** FHIR R4 types, RBAC matrix, Drizzle schema + first migration,
  NestJS gateway bootstrap, Angular app bootstrap, one end-to-end role flow.
- **Phase 3:** remaining microservices, Kafka wiring, RAG pipeline, Playwright
  visual regression, deployment target.

## License

Proprietary. All rights reserved.
