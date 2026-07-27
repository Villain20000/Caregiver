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
