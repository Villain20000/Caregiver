/**
 * apps/web/src/app/pages/orders/orders.component.spec.ts
 *
 * Unit tests for OrdersComponent — order creation routing, listing,
 * fill/dispense actions, and role-based order-type gating.
 *
 * AuthService is mocked with `currentUser` + `userRole` signals; OrderService
 * is a jasmine spy whose methods return `of(...)` observables (the component
 * awaits `.toPromise()`). Child components (app-order-create / app-order-list)
 * are instantiated for real — they are presentational and dependency-free.
 */
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { OrdersComponent } from './orders.component';
import { AuthService } from '../../services/auth.service';
import { OrderService } from '../../services/order.service';
import type { UserProfile, OrderResponse, CreateOrderRequest } from '@caregiver/contracts';

function makeUser(role: UserProfile['role'], id = `user-${role}`): UserProfile {
  return { id, email: `${role}@caregiver.test`, fullName: 'Test User', role, isActive: true };
}

function makeOrder(overrides: Partial<OrderResponse> = {}): OrderResponse {
  return {
    id: 'order-1',
    patientId: 'pat-1',
    practitionerId: 'doc-1',
    orderType: 'lab',
    status: 'active',
    code: 'LAB-1',
    display: 'Complete Blood Count',
    priority: 'routine',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('OrdersComponent', () => {
  let orderService: jasmine.SpyObj<
    Pick<
      OrderService,
      | 'listOrders'
      | 'createLabOrder'
      | 'createImagingOrder'
      | 'createMedicationOrder'
      | 'fillOrder'
      | 'dispenseOrder'
    >
  >;

  beforeEach(() => {
    orderService = jasmine.createSpyObj('OrderService', [
      'listOrders',
      'createLabOrder',
      'createImagingOrder',
      'createMedicationOrder',
      'fillOrder',
      'dispenseOrder',
    ]);
    orderService.listOrders.and.returnValue(of([]));
    orderService.createLabOrder.and.returnValue(of(makeOrder({ id: 'new-lab' })));
    orderService.createImagingOrder.and.returnValue(
      of(makeOrder({ id: 'new-imaging', orderType: 'imaging' })),
    );
    orderService.createMedicationOrder.and.returnValue(
      of(makeOrder({ id: 'new-med', orderType: 'medication' })),
    );
  });

  function createOrders(user: UserProfile | null) {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: { currentUser: signal(user), userRole: signal(user?.role ?? null) },
        },
        { provide: OrderService, useValue: orderService },
      ],
    });
    const fixture = TestBed.createComponent(OrdersComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  }

  // ── Data loading ────────────────────────────────────────────

  it('loads orders on init and clears the loading flag', async () => {
    orderService.listOrders.and.returnValue(of([makeOrder(), makeOrder({ id: 'order-2' })]));
    const { component, fixture } = createOrders(makeUser('doctor'));

    expect(orderService.listOrders).toHaveBeenCalled();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.loading()).toBe(false);
    expect(component.orders().length).toBe(2);
    expect(component.error()).toBeNull();
  });

  it('surfaces an error banner when loading fails', async () => {
    orderService.listOrders.and.returnValue(throwError(() => new Error('boom')));
    const { component, fixture } = createOrders(makeUser('doctor'));

    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.error()).toBe('Failed to load orders.');
    expect(fixture.nativeElement.textContent).toContain('Failed to load orders.');
  });

  // ── RBAC: allowed order types + fulfill permission ──────────

  it('allows doctors to create all three order types but not fulfill', () => {
    const { component } = createOrders(makeUser('doctor'));

    expect(component.allowedTypes()).toEqual(['lab', 'imaging', 'medication']);
    expect(component.canCreate()).toBe(true);
    expect(component.canFulfill()).toBe(false);
  });

  it('restricts lab_tech to lab orders only', () => {
    const { component } = createOrders(makeUser('lab_tech'));
    expect(component.allowedTypes()).toEqual(['lab']);
  });

  it('restricts radiologist to imaging orders only', () => {
    const { component } = createOrders(makeUser('radiologist'));
    expect(component.allowedTypes()).toEqual(['imaging']);
  });

  it('restricts pharmacist to medication orders only', () => {
    const { component } = createOrders(makeUser('pharmacist'));
    expect(component.allowedTypes()).toEqual(['medication']);
  });

  it('hides order creation and fulfillment for roles without access', () => {
    const { component, fixture } = createOrders(makeUser('patient'));

    expect(component.allowedTypes()).toEqual([]);
    expect(component.canCreate()).toBe(false);
    expect(component.canFulfill()).toBe(false);
    expect(fixture.nativeElement.textContent).not.toContain('Create Order');
  });

  it('allows nurses to fulfill orders but not create them', () => {
    const { component } = createOrders(makeUser('nurse'));

    expect(component.canCreate()).toBe(false);
    expect(component.canFulfill()).toBe(true);
  });

  // ── Creation ────────────────────────────────────────────────

  it('routes a lab request to createLabOrder and prepends the result', async () => {
    const labRequest: CreateOrderRequest = {
      patientId: 'pat-1',
      practitionerId: 'doc-1',
      orderType: 'lab',
      code: 'LAB-1',
      display: 'CBC',
    };
    orderService.createLabOrder.and.returnValue(of(makeOrder({ id: 'lab-new' })));
    const { component } = createOrders(makeUser('doctor'));

    await component.onCreate(labRequest);

    expect(orderService.createLabOrder).toHaveBeenCalledWith(labRequest);
    expect(component.orders()[0]?.id).toBe('lab-new');
    expect(component.resetTick()).toBe(1);
    expect(component.submitting()).toBe(false);
  });

  it('routes imaging and medication requests to their service methods', async () => {
    const imagingRequest: CreateOrderRequest = {
      patientId: 'pat-1',
      practitionerId: 'doc-1',
      orderType: 'imaging',
      code: 'IMG-1',
      display: 'Chest X-Ray',
    };
    const medRequest: CreateOrderRequest = {
      patientId: 'pat-1',
      practitionerId: 'doc-1',
      orderType: 'medication',
      medicationCode: 'MED-1',
      medicationDisplay: 'Amoxicillin',
      dosageInstructions: '500mg twice daily',
    };
    const { component } = createOrders(makeUser('doctor'));

    await component.onCreate(imagingRequest);
    await component.onCreate(medRequest);

    expect(orderService.createImagingOrder).toHaveBeenCalledWith(imagingRequest);
    expect(orderService.createMedicationOrder).toHaveBeenCalledWith(medRequest);
    expect(component.orders().length).toBe(2);
  });

  it('surfaces an error when order creation fails', async () => {
    orderService.createLabOrder.and.returnValue(throwError(() => new Error('boom')));
    const { component } = createOrders(makeUser('doctor'));

    const labRequest: CreateOrderRequest = {
      patientId: 'pat-1',
      practitionerId: 'doc-1',
      orderType: 'lab',
      code: 'LAB-1',
      display: 'CBC',
    };
    await component.onCreate(labRequest);

    expect(component.error()).toBe('Failed to create order.');
    expect(component.orders()).toEqual([]);
  });

  // ── Fill / dispense ─────────────────────────────────────────

  it('fills an active order and updates it in place', async () => {
    const active = makeOrder({ id: 'o1', status: 'active' });
    orderService.listOrders.and.returnValue(of([active]));
    const user = makeUser('nurse');
    const { component, fixture } = createOrders(user);
    await fixture.whenStable();

    const fulfilled = { ...active, status: 'completed' as const };
    orderService.fillOrder.and.returnValue(of(fulfilled));
    await component.onFill('o1');

    expect(orderService.fillOrder).toHaveBeenCalledWith('o1', user.id);
    expect(component.orders()[0]?.status).toBe('completed');
  });

  it('dispenses an order with quantity 1 and the current user id', async () => {
    const active = makeOrder({ id: 'o1', status: 'active', orderType: 'medication' });
    orderService.listOrders.and.returnValue(of([active]));
    const user = makeUser('pharmacist');
    const { component, fixture } = createOrders(user);
    await fixture.whenStable();

    const dispensed = { ...active, status: 'completed' as const };
    orderService.dispenseOrder.and.returnValue(of(dispensed));
    await component.onDispense('o1');

    expect(orderService.dispenseOrder).toHaveBeenCalledWith('o1', user.id, 1);
    expect(component.orders()[0]?.status).toBe('completed');
  });

  it('surfaces an error when fill fails', async () => {
    orderService.listOrders.and.returnValue(of([makeOrder({ id: 'o1' })]));
    const { component, fixture } = createOrders(makeUser('nurse'));
    await fixture.whenStable();

    orderService.fillOrder.and.returnValue(throwError(() => new Error('boom')));
    await component.onFill('o1');

    expect(component.error()).toBe('Failed to fill order.');
  });
});
