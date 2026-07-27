/**
 * apps/web/src/app/pages/orders/orders.component.ts
 *
 * Clinical Orders page.
 *
 * Orchestrates order creation, listing, and fulfillment (fill/dispense).
 * RBAC logic determines which order types a user may create and whether
 * they can fulfill active orders.
 */
import { Component, inject, signal, computed, type OnInit } from '@angular/core';
import { AuthService } from '../../services/auth.service.js';
import { OrderService } from '../../services/order.service.js';
import type { OrderResponse, CreateOrderRequest } from '@caregiver/contracts';
import { OrderCreateComponent } from './order-create.component.js';
import { OrderListComponent } from './order-list.component.js';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [OrderCreateComponent, OrderListComponent],
  template: `
    <div class="page">
      <h1>Clinical Orders</h1>
      <p class="page-subtitle">Create and manage lab, imaging, and medication orders.</p>

      @if (error()) {
        <div class="error-banner">{{ error() }}</div>
      }

      @if (canCreate()) {
        <app-order-create
          [allowedTypes]="allowedTypes()"
          [submitting]="submitting()"
          [resetTick]="resetTick()"
          (create)="onCreate($event)"
        />
      }

      <app-order-list
        [orders]="orders()"
        [loading]="loading()"
        [canFulfill]="canFulfill()"
        (fill)="onFill($event)"
        (dispense)="onDispense($event)"
      />
    </div>
  `,
  styles: [`
    .page { max-width: 1200px; margin: 0 auto; }
    h1 { color: #1a237e; margin-bottom: 0.25rem; }
    .page-subtitle { color: #666; margin-top: 0; }
    .error-banner {
      margin-top: 1rem; padding: 0.75rem; background: #ffebee;
      border: 1px solid #ef9a9a; border-radius: 4px;
      color: #c62828; font-size: 0.875rem;
    }
  `],
})
export class OrdersComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly orderService = inject(OrderService);

  readonly orders = signal<OrderResponse[]>([]);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  readonly resetTick = signal(0);

  /** Whether the current role may create any orders. */
  readonly canCreate = computed(() => this.allowedTypes().length > 0);

  /** Order types the current role is allowed to create. */
  readonly allowedTypes = computed(() => {
    const role = this.authService.userRole();
    if (!role) return [] as Array<'lab' | 'imaging' | 'medication'>;
    if (role === 'lab_tech') return ['lab'];
    if (role === 'radiologist') return ['imaging'];
    if (role === 'pharmacist') return ['medication'];
    if (['admin', 'doctor', 'medical_director'].includes(role)) return ['lab', 'imaging', 'medication'];
    return [] as Array<'lab' | 'imaging' | 'medication'>;
  });

  /** Whether the current role may fill or dispense active orders. */
  readonly canFulfill = computed(() => {
    const role = this.authService.userRole();
    if (!role) return false;
    return ['admin', 'medical_director', 'nurse', 'pharmacist'].includes(role);
  });

  ngOnInit(): void {
    this.loadOrders();
  }

  private async loadOrders(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const orders = await this.orderService.listOrders().toPromise();
      this.orders.set(orders ?? []);
    } catch {
      this.error.set('Failed to load orders.');
    } finally {
      this.loading.set(false);
    }
  }

  /** Route a submitted order request to the correct service call. */
  async onCreate(request: CreateOrderRequest): Promise<void> {
    this.submitting.set(true);
    this.error.set(null);
    try {
      let result: OrderResponse | undefined;
      if (request.orderType === 'lab') {
        result = await this.orderService.createLabOrder(request).toPromise();
      } else if (request.orderType === 'imaging') {
        result = await this.orderService.createImagingOrder(request).toPromise();
      } else {
        result = await this.orderService.createMedicationOrder(request).toPromise();
      }
      if (result) {
        this.orders.update((prev) => [result, ...prev]);
        this.resetTick.update((tick) => tick + 1);
      }
    } catch {
      this.error.set('Failed to create order.');
    } finally {
      this.submitting.set(false);
    }
  }

  /** Mark an order as filled. */
  async onFill(id: string): Promise<void> {
    this.error.set(null);
    try {
      const userId = this.authService.currentUser()?.id ?? '';
      const result = await this.orderService.fillOrder(id, userId).toPromise();
      if (result) this.updateOrder(result);
    } catch {
      this.error.set('Failed to fill order.');
    }
  }

  /** Mark an order as dispensed. */
  async onDispense(id: string): Promise<void> {
    this.error.set(null);
    try {
      const userId = this.authService.currentUser()?.id ?? '';
      const result = await this.orderService.dispenseOrder(id, userId, 1).toPromise();
      if (result) this.updateOrder(result);
    } catch {
      this.error.set('Failed to dispense order.');
    }
  }

  private updateOrder(updated: OrderResponse): void {
    this.orders.update((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
  }
}
