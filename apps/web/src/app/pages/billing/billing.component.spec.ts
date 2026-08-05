/**
 * apps/web/src/app/pages/billing/billing.component.spec.ts
 *
 * Unit tests for BillingComponent — claims/summary loading, RBAC-gated
 * actions, claim creation, inline adjudication and payment forms.
 *
 * AuthService is mocked with `currentUser` + `userRole` signals; BillingService
 * is a jasmine spy. Child components (summary / create-claim / claims-list) are
 * rendered for real — they are presentational and dependency-free.
 */
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { BillingComponent } from './billing.component';
import { AuthService } from '../../services/auth.service';
import { BillingService } from '../../services/billing.service';
import type {
  UserProfile,
  ClaimResponse,
  CreateClaimRequest,
  BillingSummaryResponse,
} from '@caregiver/contracts';

function makeUser(role: UserProfile['role'], id = `user-${role}`): UserProfile {
  return { id, email: `${role}@caregiver.test`, fullName: 'Test User', role, isActive: true };
}

function makeClaim(overrides: Partial<ClaimResponse> = {}): ClaimResponse {
  return {
    id: 'claim-1',
    patientId: 'pat-1',
    providerId: 'prov-1',
    insurerId: 'ins-1',
    status: 'draft',
    type: 'professional',
    use: 'claim',
    totalAmount: 100,
    items: [{ serviceCode: 'SRV-1', quantity: 1, unitPrice: 100, netAmount: 100 }],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeSummary(overrides: Partial<BillingSummaryResponse> = {}): BillingSummaryResponse {
  return {
    totalClaims: 5,
    totalBilled: 1000,
    totalApproved: 800,
    totalPaid: 700,
    totalDenied: 200,
    denialRate: 0.2,
    ...overrides,
  };
}

describe('BillingComponent', () => {
  let billingService: jasmine.SpyObj<
    Pick<
      BillingService,
      | 'listClaims'
      | 'getSummary'
      | 'createClaim'
      | 'submitClaim'
      | 'adjudicateClaim'
      | 'postPayment'
    >
  >;

  beforeEach(() => {
    billingService = jasmine.createSpyObj('BillingService', [
      'listClaims',
      'getSummary',
      'createClaim',
      'submitClaim',
      'adjudicateClaim',
      'postPayment',
    ]);
    billingService.listClaims.and.returnValue(of([]));
    billingService.getSummary.and.returnValue(of(makeSummary()));
    billingService.createClaim.and.returnValue(of(makeClaim({ id: 'new-claim' })));
  });

  function createBilling(user: UserProfile | null) {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: { currentUser: signal(user), userRole: signal(user?.role ?? null) },
        },
        { provide: BillingService, useValue: billingService },
      ],
    });
    const fixture = TestBed.createComponent(BillingComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  }

  // ── Data loading ────────────────────────────────────────────

  it('loads claims and summary on init', async () => {
    billingService.listClaims.and.returnValue(of([makeClaim()]));
    const { component, fixture } = createBilling(makeUser('billing_specialist'));

    expect(billingService.listClaims).toHaveBeenCalled();
    expect(billingService.getSummary).toHaveBeenCalled();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.loading()).toBe(false);
    expect(component.claims().length).toBe(1);
    expect(component.summary()?.totalClaims).toBe(5);
    expect(component.error()).toBeNull();
  });

  it('surfaces an error banner when claims fail to load', async () => {
    billingService.listClaims.and.returnValue(throwError(() => new Error('boom')));
    const { component, fixture } = createBilling(makeUser('billing_specialist'));

    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.error()).toBe('Failed to load claims.');
    expect(fixture.nativeElement.textContent).toContain('Failed to load claims.');
  });

  it('treats a summary load failure as non-critical', async () => {
    billingService.getSummary.and.returnValue(throwError(() => new Error('boom')));
    const { component, fixture } = createBilling(makeUser('billing_specialist'));

    await fixture.whenStable();

    expect(component.summary()).toBeNull();
    expect(component.error()).toBeNull();
  });

  // ── RBAC gating ─────────────────────────────────────────────

  it('allows billing_specialist to create, submit/pay, and adjudicate', () => {
    const { component } = createBilling(makeUser('billing_specialist'));

    expect(component.canCreateClaim()).toBe(true);
    expect(component.canSubmitPay()).toBe(true);
    expect(component.canAdjudicate()).toBe(true);
  });

  it('allows doctor to do none of the billing actions', () => {
    const { component, fixture } = createBilling(makeUser('doctor'));

    expect(component.canCreateClaim()).toBe(false);
    expect(component.canSubmitPay()).toBe(false);
    expect(component.canAdjudicate()).toBe(false);
    expect(fixture.nativeElement.textContent).not.toContain('Create Claim');
  });

  it('allows medical_director to create and adjudicate but not submit/pay', () => {
    const { component } = createBilling(makeUser('medical_director'));

    expect(component.canCreateClaim()).toBe(true);
    expect(component.canSubmitPay()).toBe(false);
    expect(component.canAdjudicate()).toBe(true);
  });

  // ── Claim creation ──────────────────────────────────────────

  it('prepends a created claim, resets the form, and reloads the summary', async () => {
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
    billingService.createClaim.and.returnValue(of(makeClaim({ id: 'claim-new' })));
    const { component } = createBilling(makeUser('billing_specialist'));

    await component.onCreateClaim(request);

    expect(billingService.createClaim).toHaveBeenCalledWith(request);
    expect(component.claims()[0]?.id).toBe('claim-new');
    expect(component.resetTick()).toBe(1);
    expect(billingService.getSummary).toHaveBeenCalledTimes(2);
    expect(component.processing()).toBe(false);
  });

  it('surfaces an error when claim creation fails', async () => {
    billingService.createClaim.and.returnValue(throwError(() => new Error('boom')));
    const { component } = createBilling(makeUser('billing_specialist'));

    const request: CreateClaimRequest = {
      patientId: 'pat-1',
      providerId: 'prov-1',
      insurerId: 'ins-1',
      type: 'professional',
      use: 'claim',
      items: [],
    };
    await component.onCreateClaim(request);

    expect(component.error()).toBe('Failed to create claim.');
  });

  it('submits a claim with the current user id', async () => {
    const draft = makeClaim({ id: 'c1', status: 'draft' });
    billingService.listClaims.and.returnValue(of([draft]));
    const user = makeUser('billing_specialist');
    const { component, fixture } = createBilling(user);
    await fixture.whenStable();

    const submitted = { ...draft, status: 'submitted' as const };
    billingService.submitClaim.and.returnValue(of(submitted));
    await component.onSubmitClaim('c1');

    expect(billingService.submitClaim).toHaveBeenCalledWith('c1', user.id);
    expect(component.claims()[0]?.status).toBe('submitted');
  });

  // ── Inline adjudication ─────────────────────────────────────

  it('opens the adjudication form pre-populated with the claim total', () => {
    const claim = makeClaim({ id: 'c1', status: 'submitted', totalAmount: 200 });
    const { component } = createBilling(makeUser('billing_specialist'));

    component.onAdjudicate(claim);

    expect(component.showAdjudicationForm()).toBe(true);
    expect(component.adjudicationForm.getRawValue().approvedAmount).toBe(200);
    expect(component.adjudicationForm.getRawValue().deniedAmount).toBe(0);
  });

  it('cancels adjudication and hides the form', () => {
    const claim = makeClaim({ id: 'c1', status: 'submitted' });
    const { component } = createBilling(makeUser('billing_specialist'));

    component.onAdjudicate(claim);
    component.cancelAdjudicate();

    expect(component.showAdjudicationForm()).toBe(false);
  });

  it('submits adjudication with line-item amounts and closes the form', async () => {
    const claim = makeClaim({
      id: 'c1',
      status: 'submitted',
      totalAmount: 200,
      items: [{ serviceCode: 'SRV-1', quantity: 1, unitPrice: 200, netAmount: 200 }],
    });
    billingService.listClaims.and.returnValue(of([claim]));
    const { component, fixture } = createBilling(makeUser('billing_specialist'));
    await fixture.whenStable();

    component.onAdjudicate(claim);
    const adjudicated = { ...claim, status: 'adjudicated' as const };
    billingService.adjudicateClaim.and.returnValue(of(adjudicated));
    await component.submitAdjudication();

    expect(billingService.adjudicateClaim).toHaveBeenCalledWith('c1', 'adjudicated', [
      { serviceCode: 'SRV-1', amountApproved: 200, amountDenied: 0 },
    ]);
    expect(component.claims()[0]?.status).toBe('adjudicated');
    expect(component.adjudicatingClaimId()).toBeNull();
  });

  it('marks a fully-denied adjudication with the denied outcome', async () => {
    const claim = makeClaim({
      id: 'c1',
      status: 'submitted',
      totalAmount: 100,
      items: [{ serviceCode: 'SRV-1', quantity: 1, unitPrice: 100, netAmount: 100 }],
    });
    billingService.listClaims.and.returnValue(of([claim]));
    const { component, fixture } = createBilling(makeUser('billing_specialist'));
    await fixture.whenStable();

    component.onAdjudicate(claim);
    component.adjudicationForm.setValue({ approvedAmount: 0, deniedAmount: 100 });
    billingService.adjudicateClaim.and.returnValue(of({ ...claim, status: 'denied' }));
    await component.submitAdjudication();

    expect(billingService.adjudicateClaim).toHaveBeenCalledWith('c1', 'denied', [
      { serviceCode: 'SRV-1', amountApproved: 0, amountDenied: 100 },
    ]);
  });

  // ── Inline payment ──────────────────────────────────────────

  it('opens the payment form pre-populated with the approved amount', () => {
    const claim = makeClaim({
      id: 'c1',
      status: 'adjudicated',
      totalAmount: 200,
      amountApproved: 150,
    });
    const today = new Date().toISOString().split('T')[0] ?? '';
    const { component } = createBilling(makeUser('billing_specialist'));

    component.onPayment(claim);

    expect(component.showPaymentForm()).toBe(true);
    expect(component.paymentForm.getRawValue().amount).toBe(150);
    expect(component.paymentForm.getRawValue().paymentMethod).toBe('check');
    expect(component.paymentForm.getRawValue().paymentDate).toBe(today);
  });

  it('posts a payment and closes the payment form', async () => {
    const claim = makeClaim({
      id: 'c1',
      status: 'adjudicated',
      totalAmount: 200,
      amountApproved: 150,
    });
    const today = new Date().toISOString().split('T')[0] ?? '';
    billingService.listClaims.and.returnValue(of([claim]));
    const { component, fixture } = createBilling(makeUser('billing_specialist'));
    await fixture.whenStable();

    component.onPayment(claim);
    const paid = { ...claim, status: 'paid' as const };
    billingService.postPayment.and.returnValue(of(paid));
    await component.submitPayment();

    expect(billingService.postPayment).toHaveBeenCalledWith('c1', 150, today, 'check');
    expect(component.claims()[0]?.status).toBe('paid');
    expect(component.payingClaimId()).toBeNull();
  });

  it('does not post a payment when the form is invalid', async () => {
    const claim = makeClaim({ id: 'c1', status: 'adjudicated' });
    const { component } = createBilling(makeUser('billing_specialist'));

    component.onPayment(claim);
    component.paymentForm.controls.amount.setValue(0);
    await component.submitPayment();

    expect(billingService.postPayment).not.toHaveBeenCalled();
  });

  // ── Template wiring ─────────────────────────────────────────

  it('renders the inline adjudication form when one is open', () => {
    const claim = makeClaim({ id: 'c1', status: 'submitted' });
    const { component, fixture } = createBilling(makeUser('billing_specialist'));

    component.onAdjudicate(claim);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Adjudicate Claim');
    expect(fixture.nativeElement.querySelector('#approvedAmount')).not.toBeNull();
  });
});
