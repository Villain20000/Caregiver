/**
 * apps/web/src/app/services/order.service.spec.ts
 *
 * Unit tests for OrderService — the clinical orders API client.
 *
 * Follows the auth.service.spec.ts pattern: HttpClient is replaced with a
 * jasmine SpyObj, and each method's HTTP verb, URL, and request body are
 * asserted directly. This is the API contract layer, so the specs pin the
 * exact endpoints the frontend depends on.
 */
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { OrderService } from './order.service';
import type {
  CreateLabOrderRequest,
  CreateImagingOrderRequest,
  CreateMedicationOrderRequest,
  OrderResponse,
} from '@caregiver/contracts';

describe('OrderService', () => {
  let httpSpy: jasmine.SpyObj<Pick<HttpClient, 'get' | 'post'>>;

  const mockOrder: OrderResponse = {
    id: 'ord-1',
    patientId: 'pat-1',
    practitionerId: 'prov-1',
    orderType: 'lab',
    status: 'active',
    code: 'CBC',
    display: 'Complete Blood Count',
    priority: 'routine',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    httpSpy = jasmine.createSpyObj('HttpClient', ['get', 'post']);
    TestBed.configureTestingModule({
      providers: [{ provide: HttpClient, useValue: httpSpy }],
    });
  });

  function createService(): OrderService {
    return TestBed.inject(OrderService);
  }

  it('creates a lab order', () => {
    httpSpy.post.and.returnValue(of(mockOrder));
    const service = createService();

    const request: CreateLabOrderRequest = {
      patientId: 'pat-1',
      practitionerId: 'prov-1',
      orderType: 'lab',
      code: 'CBC',
      display: 'Complete Blood Count',
    };
    let received: OrderResponse | undefined;
    service.createLabOrder(request).subscribe((order) => (received = order));

    expect(httpSpy.post).toHaveBeenCalledWith('/api/orders/lab', request);
    expect(received?.id).toBe('ord-1');
  });

  it('creates an imaging order', () => {
    httpSpy.post.and.returnValue(of(mockOrder));
    const service = createService();

    const request: CreateImagingOrderRequest = {
      patientId: 'pat-1',
      practitionerId: 'prov-1',
      orderType: 'imaging',
      code: 'XR-CHEST',
      display: 'Chest X-Ray',
      bodySite: 'Chest',
    };
    service.createImagingOrder(request).subscribe();

    expect(httpSpy.post).toHaveBeenCalledWith('/api/orders/imaging', request);
  });

  it('creates a medication order', () => {
    httpSpy.post.and.returnValue(of(mockOrder));
    const service = createService();

    const request: CreateMedicationOrderRequest = {
      patientId: 'pat-1',
      practitionerId: 'prov-1',
      orderType: 'medication',
      medicationCode: 'RX-1',
      medicationDisplay: 'Amoxicillin 500mg',
      dosageInstructions: 'Take twice daily',
    };
    service.createMedicationOrder(request).subscribe();

    expect(httpSpy.post).toHaveBeenCalledWith('/api/orders/medication', request);
  });

  it('fills an order with the pharmacist id and optional notes', () => {
    httpSpy.post.and.returnValue(of(mockOrder));
    const service = createService();

    service.fillOrder('ord-1', 'pharm-1', 'Filled at window 2').subscribe();

    expect(httpSpy.post).toHaveBeenCalledWith('/api/orders/ord-1/fill', {
      pharmacistId: 'pharm-1',
      notes: 'Filled at window 2',
    });
  });

  it('fills an order without notes when none are provided', () => {
    httpSpy.post.and.returnValue(of(mockOrder));
    const service = createService();

    service.fillOrder('ord-1', 'pharm-1').subscribe();

    expect(httpSpy.post).toHaveBeenCalledWith('/api/orders/ord-1/fill', {
      pharmacistId: 'pharm-1',
      notes: undefined,
    });
  });

  it('dispenses an order with quantity and optional notes', () => {
    httpSpy.post.and.returnValue(of(mockOrder));
    const service = createService();

    service.dispenseOrder('ord-1', 'pharm-1', 30, 'Dispensed 30 tablets').subscribe();

    expect(httpSpy.post).toHaveBeenCalledWith('/api/orders/ord-1/dispense', {
      pharmacistId: 'pharm-1',
      quantityDispensed: 30,
      notes: 'Dispensed 30 tablets',
    });
  });

  it('dispenses an order without notes when none are provided', () => {
    httpSpy.post.and.returnValue(of(mockOrder));
    const service = createService();

    service.dispenseOrder('ord-1', 'pharm-1', 30).subscribe();

    expect(httpSpy.post).toHaveBeenCalledWith('/api/orders/ord-1/dispense', {
      pharmacistId: 'pharm-1',
      quantityDispensed: 30,
      notes: undefined,
    });
  });

  it('lists all orders', () => {
    httpSpy.get.and.returnValue(of([mockOrder]));
    const service = createService();

    let received: OrderResponse[] = [];
    service.listOrders().subscribe((orders) => (received = orders));

    expect(httpSpy.get).toHaveBeenCalledWith('/api/orders');
    expect(received.length).toBe(1);
  });

  it('retrieves a single order by id', () => {
    httpSpy.get.and.returnValue(of(mockOrder));
    const service = createService();

    let received: OrderResponse | undefined;
    service.getOrder('ord-1').subscribe((order) => (received = order));

    expect(httpSpy.get).toHaveBeenCalledWith('/api/orders/ord-1');
    expect(received?.id).toBe('ord-1');
  });
});
