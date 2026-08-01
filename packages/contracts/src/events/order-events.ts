/**
 * packages/contracts/src/events/order-events.ts
 *
 * Event payload types for order lifecycle events.
 *
 * Topics:
 *   - order.created   → emitted by API gateway when a new order is placed
 *   - order.filled    → emitted by pharmacist when filling an order
 *   - order.dispensed → emitted when medication is dispensed to patient
 */

/** Payload for `order.created` — a new clinical order was placed. */
export interface OrderCreatedPayload {
  orderId: string;
  patientId: string;
  practitionerId: string;
  orderType: 'lab' | 'imaging' | 'medication';
  code: string;
  display: string;
  reason?: string;
  priority: string;
}

export interface OrderFilledPayload {
  orderId: string;
  filledBy: string;
  notes?: string;
}

export interface OrderDispensedPayload {
  orderId: string;
  dispensedBy: string;
  quantityDispensed: number;
  notes?: string;
}
