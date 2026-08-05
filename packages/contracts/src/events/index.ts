/**
 * packages/contracts/src/events/index.ts
 *
 * Event payload type map — binds each Kafka topic to its payload type.
 *
 * This enables end-to-end type safety: when a producer sends to a topic,
 * TypeScript knows the exact payload shape. When a consumer subscribes
 * to a topic, it receives a typed payload.
 *
 * @example
 *   // Producer side:
 *   producer.send('appointment.created', { patientId: '...', ... });
 *   //                    ↑ topic         ↑ typed payload
 *
 *   // Consumer side:
 *   consumer.subscribe('appointment.created', (envelope) => {
 *     envelope.payload.patientId; // typed!
 *   });
 */
import type { KafkaTopic } from '@caregiver/kafka';

import type { FhirResourceIngestedPayload, FhirResourceValidatedPayload } from './fhir-events.js';
import type { AppointmentCreatedPayload, AppointmentUpdatedPayload } from './appointment-events.js';
import type { VitalsRecordedPayload } from './vitals-events.js';
import type { AlertDispatchedPayload, AlertAcknowledgedPayload } from './alert-events.js';
import type { AiDiagnosisRequestedPayload, AiDiagnosisCompletedPayload } from './ai-events.js';
import type { AuditEventPayload } from './audit-events.js';
import type {
  OrderCreatedPayload,
  OrderFilledPayload,
  OrderDispensedPayload,
} from './order-events.js';
import type {
  ClaimCreatedPayload,
  ClaimSubmittedPayload,
  ClaimAdjudicatedPayload,
  PaymentPostedPayload,
} from './billing-events.js';

// Re-export for consumer convenience
export type {
  OrderCreatedPayload,
  OrderFilledPayload,
  OrderDispensedPayload,
} from './order-events.js';
export type {
  ClaimCreatedPayload,
  ClaimSubmittedPayload,
  ClaimAdjudicatedPayload,
  PaymentPostedPayload,
} from './billing-events.js';

/**
 * Type map: KafkaTopic → payload type.
 * Adding a new topic requires adding its payload type here.
 */
export interface EventPayloads {
  'fhir.resource.ingested': FhirResourceIngestedPayload;
  'fhir.resource.validated': FhirResourceValidatedPayload;
  'appointment.created': AppointmentCreatedPayload;
  'appointment.updated': AppointmentUpdatedPayload;
  'vitals.recorded': VitalsRecordedPayload;
  'alert.dispatched': AlertDispatchedPayload;
  'alert.acknowledged': AlertAcknowledgedPayload;
  'ai.diagnosis.requested': AiDiagnosisRequestedPayload;
  'ai.diagnosis.completed': AiDiagnosisCompletedPayload;
  'audit.event': AuditEventPayload;
  'order.created': OrderCreatedPayload;
  'order.filled': OrderFilledPayload;
  'order.dispensed': OrderDispensedPayload;
  'claim.created': ClaimCreatedPayload;
  'claim.submitted': ClaimSubmittedPayload;
  'claim.adjudicated': ClaimAdjudicatedPayload;
  'payment.posted': PaymentPostedPayload;
}

/** Helper type: get the payload type for a given topic. */
export type PayloadOf<T extends KafkaTopic> = EventPayloads[T];
