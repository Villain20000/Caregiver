/**
 * packages/contracts/src/index.ts
 *
 * Public API for the @caregiver/contracts package.
 *
 * Exports:
 *   - Event payload types (one per Kafka topic)
 *   - REST DTOs (request/response bodies for the API gateway)
 *   - The EventPayloads type map (binds topics to payload types)
 */

// ── Event payloads (one type per Kafka topic) ────────────────
export type * from './events/fhir-events.js';
export type * from './events/appointment-events.js';
export type * from './events/vitals-events.js';
export type * from './events/alert-events.js';
export type * from './events/ai-events.js';
export type * from './events/audit-events.js';

// ── Event payload type map ───────────────────────────────────
export type { EventPayloads, PayloadOf } from './events/index.js';

// ── REST DTOs ────────────────────────────────────────────────
export type * from './dto/auth.dto.js';
export type * from './dto/appointment.dto.js';
export type * from './dto/vitals.dto.js';
export type * from './dto/ai-diagnosis.dto.js';
