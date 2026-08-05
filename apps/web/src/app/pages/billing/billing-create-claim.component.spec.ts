/**
 * apps/web/src/app/pages/billing/billing-create-claim.component.spec.ts
 *
 * Unit tests for BillingCreateClaimComponent — the claim-creation form.
 * Covers line-item add/remove, typed CreateClaimRequest emission (with
 * computed netAmount), required-field validation, the resetTick reset
 * effect, and the processing-disabled submit button.
 *
 * The component injects only FormBuilder (provided by its own
 * ReactiveFormsModule import), so TestBed needs no extra providers.
 */
import { TestBed } from '@angular/core/testing';
import { BillingCreateClaimComponent } from './billing-create-claim.component';
import type { CreateClaimRequest } from '@caregiver/contracts';

describe('BillingCreateClaimComponent', () => {
  function createForm() {
    TestBed.configureTestingModule({});
    const fixture = TestBed.createComponent(BillingCreateClaimComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  }

  /** A fully-valid form value with a single priced line item. */
  const VALID_FORM = {
    patientId: 'pat-1',
    providerId: 'prov-1',
    insurerId: 'ins-1',
    type: 'professional' as const,
    use: 'claim' as const,
    items: [
      {
        serviceDate: '2026-01-01',
        code: 'SRV-1',
        codeSystem: 'CPT',
        display: 'Consultation',
        quantity: 2,
        unitPrice: 100,
      },
    ],
  };

  // ── Line items ──────────────────────────────────────────────

  it('starts with a single blank line item', () => {
    const { component } = createForm();

    expect(component.items.length).toBe(1);
  });

  it('adds a blank line item', () => {
    const { component } = createForm();

    component.addItem();

    expect(component.items.length).toBe(2);
  });

  it('removes the line item at the requested index', () => {
    const { component } = createForm();
    component.addItem();
    component.addItem();
    expect(component.items.length).toBe(3);

    component.removeItem(1);

    expect(component.items.length).toBe(2);
  });

  it('removing the only line item leaves the array empty', () => {
    const { component } = createForm();

    component.removeItem(0);

    expect(component.items.length).toBe(0);
  });

  // ── Emission ────────────────────────────────────────────────

  it('emits a typed claim request with computed netAmount on valid submit', () => {
    const { component } = createForm();
    const emitSpy = spyOn(component.createClaim, 'emit');

    component.claimForm.setValue(VALID_FORM);
    component.onSubmit();

    const expected: CreateClaimRequest = {
      patientId: 'pat-1',
      providerId: 'prov-1',
      insurerId: 'ins-1',
      type: 'professional',
      use: 'claim',
      items: [
        {
          serviceDate: '2026-01-01',
          code: 'SRV-1',
          codeSystem: 'CPT',
          display: 'Consultation',
          quantity: 2,
          unitPrice: 100,
          netAmount: 200,
        },
      ],
    };
    expect(emitSpy).toHaveBeenCalledWith(expected);
  });

  it('does not emit when required fields are missing', () => {
    const { component } = createForm();
    const emitSpy = spyOn(component.createClaim, 'emit');

    // Empty form — patientId, providerId, insurerId and the item's
    // serviceDate/code/display/quantity/unitPrice are all blank → invalid.
    component.onSubmit();

    expect(emitSpy).not.toHaveBeenCalled();
  });

  // ── Reset effect ────────────────────────────────────────────

  it('resets the form and restores a single line item when resetTick changes', async () => {
    const { fixture, component } = createForm();
    component.claimForm.setValue(VALID_FORM);
    component.addItem();
    expect(component.items.length).toBe(2);

    fixture.componentRef.setInput('resetTick', 1);
    fixture.detectChanges();
    // The constructor's `effect()` (form.reset + items re-seed) flushes on
    // the effect scheduler, so let it run before asserting the reset.
    await fixture.whenStable();

    expect(component.claimForm.controls.patientId.value).toBe('');
    expect(component.claimForm.controls.providerId.value).toBe('');
    expect(component.claimForm.controls.type.value).toBe('professional');
    expect(component.items.length).toBe(1);
  });

  // ── Processing state ────────────────────────────────────────

  it('disables the submit button while processing', () => {
    const { fixture } = createForm();
    fixture.componentRef.setInput('processing', true);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain('Creating');
  });
});
