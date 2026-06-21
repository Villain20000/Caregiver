/**
 * packages/kafka/src/__tests__/kafka.test.ts
 *
 * Unit tests for the @caregiver/kafka package.
 *
 * Covers:
 *   - KAFKA_TOPICS registry (9 entries, naming convention)
 *   - KafkaEnvelope structural sanity (runtime constructible)
 */
import { describe, it, expect } from 'vitest';

import { KAFKA_TOPICS, type KafkaTopic } from '../topics.js';
import type { KafkaEnvelope } from '../envelope.js';

// ─── KAFKA_TOPICS ──────────────────────────────────────────────
describe('KAFKA_TOPICS', () => {
  it('has 9 entries', () => {
    expect(KAFKA_TOPICS).toHaveLength(9);
  });

  it('has no duplicate topics', () => {
    expect(new Set(KAFKA_TOPICS).size).toBe(KAFKA_TOPICS.length);
  });

  // The naming convention is `<domain>.<entity>.<action>` (2+ dots) for
  // some topics, but several topics use the shorter `<domain>.<action>`
  // form (1 dot), e.g. 'appointment.created', 'vitals.recorded',
  // 'alert.dispatched', 'audit.event'. We assert the minimum structural
  // invariant shared by all topics: at least one dot separating a domain
  // from its action/entity.
  it('all topics contain at least 1 dot (domain separator)', () => {
    for (const topic of KAFKA_TOPICS) {
      const dotCount = (topic.match(/\./g) ?? []).length;
      expect(
        dotCount >= 1,
        `topic '${topic}' should contain at least 1 dot (domain separator)`,
      ).toBe(true);
    }
  });

  it('topics with the domain.entity.action form contain at least 2 dots', () => {
    // The FHIR and AI domains use the full three-segment form.
    const threeSegmentTopics = KAFKA_TOPICS.filter((t) => t.startsWith('fhir.') || t.startsWith('ai.'));
    expect(threeSegmentTopics.length).toBeGreaterThan(0);
    for (const topic of threeSegmentTopics) {
      const dotCount = (topic.match(/\./g) ?? []).length;
      expect(dotCount, `topic '${topic}'`).toBeGreaterThanOrEqual(2);
    }
  });

  it('every topic is a non-empty string', () => {
    for (const topic of KAFKA_TOPICS) {
      expect(typeof topic).toBe('string');
      expect(topic.length).toBeGreaterThan(0);
    }
  });

  it('contains the expected canonical topics', () => {
    expect([...KAFKA_TOPICS]).toEqual([
      'fhir.resource.ingested',
      'fhir.resource.validated',
      'appointment.created',
      'appointment.updated',
      'vitals.recorded',
      'alert.dispatched',
      'ai.diagnosis.requested',
      'ai.diagnosis.completed',
      'audit.event',
    ]);
  });
});

// ─── KafkaEnvelope ─────────────────────────────────────────────
describe('KafkaEnvelope', () => {
  it('can be constructed as a runtime object matching the interface shape', () => {
    // KafkaEnvelope is a type-only export, but we can verify a conforming
    // runtime object satisfies the structural contract.
    const envelope: KafkaEnvelope<{ patientId: string }> = {
      eventId: 'evt-123',
      eventType: 'appointment.created' as KafkaTopic,
      timestamp: '2025-01-01T00:00:00Z',
      source: 'api-gateway',
      correlationId: 'corr-1',
      userId: 'u-1',
      userRole: 'doctor',
      payload: { patientId: 'p-1' },
    };

    expect(envelope.eventId).toBe('evt-123');
    expect(envelope.eventType).toBe('appointment.created');
    expect(envelope.source).toBe('api-gateway');
    expect(envelope.payload.patientId).toBe('p-1');
  });

  it('eventType must be one of the KAFKA_TOPICS', () => {
    const validTopics = new Set<string>(KAFKA_TOPICS);
    const envelope: KafkaEnvelope = {
      eventId: 'evt-456',
      eventType: 'vitals.recorded',
      timestamp: '2025-01-01T00:00:00Z',
      source: 'fhir-ingestion',
      payload: undefined,
    };
    expect(validTopics.has(envelope.eventType)).toBe(true);
  });
});
