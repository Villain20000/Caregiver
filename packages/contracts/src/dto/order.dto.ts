/**
 * packages/contracts/src/dto/order.dto.ts
 *
 * REST DTOs for clinical orders (lab, imaging, medication).
 *
 * 📝 Learning Note: Each order type has its own create DTO with specific
 * fields (e.g. bodySite for imaging, dosageInstructions for medication).
 * The `CreateOrderRequest` union type encompasses all three.
 */

/** Create lab order request — POST /api/orders/lab. */
export interface CreateLabOrderRequest {
  patientId: string;
  practitionerId: string;
  orderType: 'lab';
  code: string;
  codeSystem?: string;
  display: string;
  reason?: string;
  notes?: string;
  priority?: 'routine' | 'urgent' | 'asap' | 'stat';
}

export interface CreateImagingOrderRequest {
  patientId: string;
  practitionerId: string;
  orderType: 'imaging';
  code: string;
  codeSystem?: string;
  display: string;
  bodySite?: string;
  reason?: string;
  notes?: string;
  priority?: 'routine' | 'urgent' | 'asap' | 'stat';
}

export interface CreateMedicationOrderRequest {
  patientId: string;
  practitionerId: string;
  orderType: 'medication';
  medicationCode: string;
  medicationDisplay: string;
  dosageInstructions: string;
  route?: string;
  quantity?: number;
  refills?: number;
  reason?: string;
  notes?: string;
  priority?: 'routine' | 'urgent' | 'asap' | 'stat';
}

export type CreateOrderRequest =
  | CreateLabOrderRequest
  | CreateImagingOrderRequest
  | CreateMedicationOrderRequest;

export interface FillOrderRequest {
  pharmacistId: string;
  notes?: string;
}

export interface DispenseOrderRequest {
  pharmacistId: string;
  quantityDispensed: number;
  notes?: string;
}

export interface OrderResponse {
  id: string;
  fhirId?: string;
  patientId: string;
  practitionerId: string;
  orderType: 'lab' | 'imaging' | 'medication';
  status: 'active' | 'completed' | 'cancelled' | 'entered-in-error';
  code: string;
  display: string;
  reason?: string;
  notes?: string;
  priority: string;
  filledBy?: string;
  dispensedBy?: string;
  createdAt: string;
  updatedAt: string;
}
