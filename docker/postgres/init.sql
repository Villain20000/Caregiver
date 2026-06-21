-- ─────────────────────────────────────────────────────────────
-- PostgreSQL init script — runs on first container boot only.
--
-- Enables extensions required by the Caregiver platform:
--   - uuid-ossp: UUID generation for FHIR resource IDs and audit entries
--   - pgcrypto:  cryptographic functions (gen_random_uuid, digest)
--   - vector:    pgvector extension for hybrid vector search
--                (complements ChromaDB; enables future Postgres-native
--                 similarity search without a separate vector DB)
-- ─────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";
