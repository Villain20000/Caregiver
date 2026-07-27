/**
 * apps/web/src/app/pages/orders/order-list.component.ts
 *
 * Order history / list component.
 *
 * Displays active and past orders and, if the user has permission,
 * exposes Fill/Dispense action buttons.
 */
import { Component, input, output } from '@angular/core';
import type { OrderResponse } from '@caregiver/contracts';

@Component({
  selector: 'app-order-list',
  standalone: true,
  imports: [],
  template: `
    <div class="history-section">
      <h2>Orders</h2>
      @if (loading()) {
        <div class="loading">Loading orders...</div>
      }
      @if (!loading() && orders().length > 0) {
        <div class="order-list">
          @for (o of orders(); track o.id) {
            <div class="order-card">
              <div class="order-header">
                <span class="order-type">{{ o.orderType }}</span>
                <span class="order-status" [class]="o.status">{{ o.status }}</span>
                <span class="order-display">{{ o.display }}</span>
              </div>
              <div class="order-body">
                <p><strong>Patient:</strong> {{ o.patientId }}</p>
                <p><strong>Practitioner:</strong> {{ o.practitionerId }}</p>
                @if (o.reason) { <p><strong>Reason:</strong> {{ o.reason }}</p> }
                @if (o.notes) { <p><strong>Notes:</strong> {{ o.notes }}</p> }
                <p class="order-priority"><strong>Priority:</strong> {{ o.priority }}</p>
              </div>
              @if (canFulfill() && o.status === 'active') {
                <div class="order-actions">
                  <button (click)="fill.emit(o.id)" class="action-btn">Fill</button>
                  <button (click)="dispense.emit(o.id)" class="action-btn">Dispense</button>
                </div>
              }
            </div>
          }
        </div>
      }
      @if (!loading() && orders().length === 0) {
        <div class="empty-state">No orders found.</div>
      }
    </div>
  `,
  styles: [`
    .history-section {
      margin-top: 1.5rem; padding: 1.5rem; background: white;
      border: 1px solid #e0e0e0; border-radius: 8px;
    }
    h2 { margin-top: 0; color: #333; font-size: 1.1rem; }
    .loading, .empty-state { text-align: center; color: #999; padding: 1rem; }
    .order-list { display: flex; flex-direction: column; gap: 0.75rem; margin-top: 1rem; }
    .order-card { padding: 1rem; background: #f5f5f5; border-radius: 6px; }
    .order-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem; flex-wrap: wrap; }
    .order-type { font-weight: 600; color: #1a237e; text-transform: uppercase; font-size: 0.75rem; }
    .order-display { font-weight: 500; }
    .order-status {
      padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.7rem;
      text-transform: uppercase; font-weight: 600;
    }
    .order-status.active { background: #fff3e0; color: #e65100; }
    .order-status.completed { background: #e8f5e9; color: #2e7d32; }
    .order-status.cancelled { background: #ffebee; color: #c62828; }
    .order-status.entered-in-error { background: #f3e5f5; color: #6a1b9a; }
    .order-body p { margin: 0.25rem 0; font-size: 0.875rem; }
    .order-priority { text-transform: capitalize; }
    .order-actions { margin-top: 0.75rem; display: flex; gap: 0.5rem; }
    .action-btn {
      padding: 0.3rem 0.7rem; border: 1px solid #1a237e; background: white;
      color: #1a237e; border-radius: 4px; cursor: pointer; font-size: 0.8rem;
    }
  `],
})
export class OrderListComponent {
  /** Orders to display. */
  readonly orders = input.required<OrderResponse[]>();
  /** True while the parent is loading data. */
  readonly loading = input<boolean>(false);
  /** Whether Fill/Dispense actions should be shown. */
  readonly canFulfill = input<boolean>(false);

  /** Emits the id of the order to fill. */
  readonly fill = output<string>();
  /** Emits the id of the order to dispense. */
  readonly dispense = output<string>();
}
