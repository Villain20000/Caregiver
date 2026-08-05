/**
 * packages/contracts/src/__tests__/contracts.test.ts
 *
 * Unit tests for the @caregiver/contracts package.
 *
 * EventPayloads is a type-only interface (no runtime value), so we cannot
 * introspect its keys at runtime. Instead we assert that the set of topic
 * keys the type map is documented to cover matches the canonical
 * KAFKA_TOPICS registry from @caregiver/kafka. This is a runtime guard that
 * the type map covers all 17 topics; a compile-time check is also enforced
 * below via a type-level assertion.
 */
import { describe, it, expect } from 'vitest';

import { KAFKA_TOPICS } from '@caregiver/kafka';

// Import the type so a compile-time error is raised if the module path or
// the EventPayloads interface is removed/renamed.
import type { EventPayloads, PayloadOf } from '../events/index.js';
import type { KafkaTopic } from '@caregiver/kafka';

/**
 * Runtime mirror of the keys declared in the EventPayloads interface
 * (packages/contracts/src/events/index.ts). If a topic is added to
 * KAFKA_TOPICS but not to EventPayloads, this array — and thus the test —
 * must be updated, surfacing the gap.
 */
const EVENT_PAYLOAD_TOPIC_KEYS = [
  'fhir.resource.ingested',
  'fhir.resource.validated',
  'appointment.created',
  'appointment.updated',
  'vitals.recorded',
  'alert.dispatched',
  'alert.acknowledged',
  'ai.diagnosis.requested',
  'ai.diagnosis.completed',
  'order.created',
  'order.filled',
  'order.dispensed',
  'claim.created',
  'claim.submitted',
  'claim.adjudicated',
  'payment.posted',
  'audit.event',
] as const;

// ─── Compile-time check ────────────────────────────────────────
// EventPayloads must map EVERY KafkaTopic to a payload type. If a topic is
// missing from the interface, this type evaluates to `never` and the
// assignment below fails to compile.
type _AllTopicsMapped = KafkaTopic extends keyof EventPayloads ? true : never;
const _compileTimeCheck: _AllTopicsMapped = true;
void _compileTimeCheck;

// PayloadOf must resolve to a non-never type for every topic.
type _PayloadDefined<T extends KafkaTopic> = PayloadOf<T> extends never ? false : true;
const _payloadCheck: _PayloadDefined<'appointment.created'> = true;
void _payloadCheck;

// ─── Tests ─────────────────────────────────────────────────────
describe('EventPayloads topic coverage', () => {
  it('maps all 17 Kafka topics (runtime assertion)', () => {
    expect(EVENT_PAYLOAD_TOPIC_KEYS).toHaveLength(17);
    expect([...EVENT_PAYLOAD_TOPIC_KEYS].sort()).toEqual([...KAFKA_TOPICS].sort());
  });

  it('has no duplicate topic keys', () => {
    expect(new Set(EVENT_PAYLOAD_TOPIC_KEYS).size).toBe(EVENT_PAYLOAD_TOPIC_KEYS.length);
  });

  it('every EventPayloads key is a valid KafkaTopic', () => {
    const validTopics = new Set<string>(KAFKA_TOPICS);
    for (const key of EVENT_PAYLOAD_TOPIC_KEYS) {
      expect(validTopics.has(key), `key '${key}' is not a valid KafkaTopic`).toBe(true);
    }
  });

  it('KAFKA_TOPICS has 17 entries (parity check)', () => {
    expect(KAFKA_TOPICS).toHaveLength(17);
  });
});
