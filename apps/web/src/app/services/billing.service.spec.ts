/**
 * apps/web/src/app/services/billing.service.spec.ts
 *
 * Unit tests for BillingService — the claims/payments API client.
 *
 * Follows the auth.service.spec.ts pattern: HttpClient is replaced with a
 * jasmine SpyObj, and each method's HTTP verb, URL, and request body are
 * asserted directly (the API contract layer).
 */
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { BillingService } from './billing.service';
import type {
  ClaimResponse,
  CreateClaimRequest,
  BillingSummaryResponse,
} from '@caregiver/contracts';

describe('BillingService', () => {
  let httpSpy: jasmine.SpyObj<Pick<HttpClient, 'get' | 'post'>>;

  const mockClaim: ClaimResponse = {
    id: 'clm-1',
    patientId: 'pat-1',
    providerId: 'prov-1',
    insurerId: 'ins-1',
    status: 'draft',
    type: 'professional',
    use: 'claim',
    totalAmount: 200,
    items: [{ serviceCode: 'SRV-1', quantity: 2, unitPrice: 100, netAmount: 200 }],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const mockSummary: BillingSummaryResponse = {
    totalClaims: 5,
    totalBilled: 1000,
    totalApproved: 800,
    totalPaid: 600,
    totalDenied: 200,
    denialRate: 20,
  };

  beforeEach(() => {
    httpSpy = jasmine.createSpyObj('HttpClient', ['get', 'post']);
    TestBed.configureTestingModule({
      providers: [{ provide: HttpClient, useValue: httpSpy }],
    });
  });

  function createService(): BillingService {
    return TestBed.inject(BillingService);
  }

  it('creates a claim', () => {
    httpSpy.post.and.returnValue(of(mockClaim));
    const service = createService();

    const request: CreateClaimRequest = {
      patientId: 'pat-1',
      providerId: 'prov-1',
      insurerId: 'ins-1',
      type: 'professional',
      use: 'claim',
      items: [
        {
          serviceDate: '2026-01-01',
          code: 'SRV-1',
          display: 'Consult',
          quantity: 1,
          unitPrice: 100,
          netAmount: 100,
        },
      ],
    };
    let received: ClaimResponse | undefined;
    service.createClaim(request).subscribe((claim) => (received = claim));

    expect(httpSpy.post).toHaveBeenCalledWith('/api/billing/claims', request);
    expect(received?.id).toBe('clm-1');
  });

  it('submits a claim', () => {
    httpSpy.post.and.returnValue(of(mockClaim));
    const service = createService();

    service.submitClaim('clm-1', 'user-1').subscribe();

    expect(httpSpy.post).toHaveBeenCalledWith('/api/billing/claims/clm-1/submit', {
      submittedBy: 'user-1',
    });
  });

  it('adjudicates a claim with line-item outcomes', () => {
    httpSpy.post.and.returnValue(of(mockClaim));
    const service = createService();

    service
      .adjudicateClaim('clm-1', 'adjudicated', [
        { serviceCode: 'SRV-1', amountApproved: 100, amountDenied: 0 },
      ])
      .subscribe();

    expect(httpSpy.post).toHaveBeenCalledWith('/api/billing/adjudicate', {
      claimId: 'clm-1',
      outcome: 'adjudicated',
      lineItems: [{ serviceCode: 'SRV-1', amountApproved: 100, amountDenied: 0 }],
    });
  });

  it('posts a payment', () => {
    httpSpy.post.and.returnValue(of(mockClaim));
    const service = createService();

    service.postPayment('clm-1', 200, '2026-01-05', 'check').subscribe();

    expect(httpSpy.post).toHaveBeenCalledWith('/api/billing/payments', {
      claimId: 'clm-1',
      amount: 200,
      paymentDate: '2026-01-05',
      paymentMethod: 'check',
    });
  });

  it('lists claims', () => {
    httpSpy.get.and.returnValue(of([mockClaim]));
    const service = createService();

    let received: ClaimResponse[] = [];
    service.listClaims().subscribe((claims) => (received = claims));

    expect(httpSpy.get).toHaveBeenCalledWith('/api/billing/claims');
    expect(received.length).toBe(1);
  });

  it('retrieves a single claim by id', () => {
    httpSpy.get.and.returnValue(of(mockClaim));
    const service = createService();

    let received: ClaimResponse | undefined;
    service.getClaim('clm-1').subscribe((claim) => (received = claim));

    expect(httpSpy.get).toHaveBeenCalledWith('/api/billing/claims/clm-1');
    expect(received?.id).toBe('clm-1');
  });

  it('fetches the aggregate billing summary', () => {
    httpSpy.get.and.returnValue(of(mockSummary));
    const service = createService();

    let received: BillingSummaryResponse | undefined;
    service.getSummary().subscribe((summary) => (received = summary));

    expect(httpSpy.get).toHaveBeenCalledWith('/api/billing/summary');
    expect(received?.totalClaims).toBe(5);
  });
});
