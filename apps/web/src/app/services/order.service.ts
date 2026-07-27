/**
 * apps/web/src/app/services/order.service.ts
 *
 * Angular service for managing clinical orders (lab, imaging, medication).
 *
 * Wraps the /api/orders endpoints for creating, filling, dispensing,
 * and listing orders.
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type {
  OrderResponse,
  CreateLabOrderRequest,
  CreateImagingOrderRequest,
  CreateMedicationOrderRequest,
} from '@caregiver/contracts';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly http = inject(HttpClient);

  /**
   * Create a new lab order.
   *
   * @param req - Lab order creation payload.
   * @returns Observable emitting the created order.
   */
  createLabOrder(req: CreateLabOrderRequest) {
    return this.http.post<OrderResponse>('/api/orders/lab', req);
  }

  /**
   * Create a new imaging order.
   *
   * @param req - Imaging order creation payload.
   * @returns Observable emitting the created order.
   */
  createImagingOrder(req: CreateImagingOrderRequest) {
    return this.http.post<OrderResponse>('/api/orders/imaging', req);
  }

  /**
   * Create a new medication order.
   *
   * @param req - Medication order creation payload.
   * @returns Observable emitting the created order.
   */
  createMedicationOrder(req: CreateMedicationOrderRequest) {
    return this.http.post<OrderResponse>('/api/orders/medication', req);
  }

  /**
   * Mark an order as filled.
   *
   * @param id - Id of the order to fill.
   * @param pharmacistId - Id of the user filling the order.
   * @param notes - Optional free-text notes.
   * @returns Observable emitting the updated order.
   */
  fillOrder(id: string, pharmacistId: string, notes?: string) {
    return this.http.post<OrderResponse>(`/api/orders/${id}/fill`, { pharmacistId, notes });
  }

  /**
   * Mark an order as dispensed.
   *
   * @param id - Id of the order to dispense.
   * @param pharmacistId - Id of the user dispensing the order.
   * @param quantityDispensed - Quantity of medication dispensed.
   * @param notes - Optional free-text notes.
   * @returns Observable emitting the updated order.
   */
  dispenseOrder(id: string, pharmacistId: string, quantityDispensed: number, notes?: string) {
    return this.http.post<OrderResponse>(`/api/orders/${id}/dispense`, { pharmacistId, quantityDispensed, notes });
  }

  /**
   * List all orders the current user is allowed to see.
   *
   * @returns Observable emitting the list of orders.
   */
  listOrders() {
    return this.http.get<OrderResponse[]>('/api/orders');
  }

  /**
   * Retrieve a single order by id.
   *
   * @param id - Order id.
   * @returns Observable emitting the order.
   */
  getOrder(id: string) {
    return this.http.get<OrderResponse>(`/api/orders/${id}`);
  }
}
