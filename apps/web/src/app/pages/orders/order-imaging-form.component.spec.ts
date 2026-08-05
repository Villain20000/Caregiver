/**
 * apps/web/src/app/pages/orders/order-imaging-form.component.spec.ts
 *
 * Unit tests for OrderImagingFormComponent — the presentational imaging
 * order form. Covers typed request emission, required-field validation,
 * optional-field normalization, the resetTick reset effect, and the
 * submitting-disabled button.
 *
 * The component is dependency-free (only injects FormBuilder, provided by its
 * own ReactiveFormsModule import), so TestBed needs no extra providers.
 */
import { TestBed } from '@angular/core/testing';
import { OrderImagingFormComponent } from './order-imaging-form.component';
import type { CreateImagingOrderRequest } from '@caregiver/contracts';

describe('OrderImagingFormComponent', () => {
  function createForm() {
    TestBed.configureTestingModule({});
    const fixture = TestBed.createComponent(OrderImagingFormComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  }

  const VALID_FORM = {
    patientId: 'pat-1',
    practitionerId: 'doc-1',
    code: 'IMG-1',
    display: 'Chest X-Ray',
    bodySite: 'Chest',
    priority: 'urgent' as const,
    reason: 'Rule out pneumonia',
    notes: 'PA and lateral views',
  };

  it('emits a typed imaging order request on valid submit', () => {
    const { component } = createForm();
    const emitSpy = spyOn(component.submitOrder, 'emit');

    component.form.setValue(VALID_FORM);
    component.onSubmit();

    expect(emitSpy).toHaveBeenCalledWith({
      patientId: 'pat-1',
      practitionerId: 'doc-1',
      orderType: 'imaging',
      code: 'IMG-1',
      display: 'Chest X-Ray',
      bodySite: 'Chest',
      priority: 'urgent',
      reason: 'Rule out pneumonia',
      notes: 'PA and lateral views',
    } satisfies CreateImagingOrderRequest);
  });

  it('does not emit when required fields are missing', () => {
    const { component } = createForm();
    const emitSpy = spyOn(component.submitOrder, 'emit');

    // Empty form — required fields (patientId, practitionerId, code, display)
    // are all blank, so the form is invalid and nothing is emitted.
    component.onSubmit();

    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('does not emit when a single required field is missing', () => {
    const { component } = createForm();
    const emitSpy = spyOn(component.submitOrder, 'emit');

    component.form.patchValue({ ...VALID_FORM, display: '' });
    component.onSubmit();

    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('maps empty optional fields to undefined in the payload', () => {
    const { component } = createForm();
    const emitSpy = spyOn(component.submitOrder, 'emit');

    component.form.setValue({
      patientId: 'pat-1',
      practitionerId: 'doc-1',
      code: 'IMG-1',
      display: 'Chest X-Ray',
      bodySite: '',
      priority: 'routine',
      reason: '',
      notes: '',
    });
    component.onSubmit();

    expect(emitSpy).toHaveBeenCalledWith(
      jasmine.objectContaining({
        orderType: 'imaging',
        bodySite: undefined,
        reason: undefined,
        notes: undefined,
      }),
    );
  });

  it('resets the form when resetTick changes', async () => {
    const { fixture, component } = createForm();
    component.form.setValue(VALID_FORM);

    fixture.componentRef.setInput('resetTick', 1);
    fixture.detectChanges();
    // The constructor's `effect()` (which calls form.reset()) flushes on the
    // effect scheduler, so let it run before asserting the reset took effect.
    await fixture.whenStable();

    expect(component.form.controls.patientId.value).toBe('');
    expect(component.form.controls.display.value).toBe('');
    expect(component.form.controls.priority.value).toBe('routine');
  });

  it('disables the submit button while submitting', () => {
    const { fixture } = createForm();
    fixture.componentRef.setInput('submitting', true);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain('Creating');
  });

  it('defaults priority to routine', () => {
    const { component } = createForm();

    expect(component.form.controls.priority.value).toBe('routine');
  });
});
