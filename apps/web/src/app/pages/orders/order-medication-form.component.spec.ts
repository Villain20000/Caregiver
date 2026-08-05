/**
 * apps/web/src/app/pages/orders/order-medication-form.component.spec.ts
 *
 * Unit tests for OrderMedicationFormComponent — the presentational medication
 * order form. Covers typed request emission, required-field validation,
 * optional-field normalization (strings + nullable quantities), the resetTick
 * reset effect, and the submitting-disabled button.
 *
 * The component is dependency-free (only injects FormBuilder, provided by its
 * own ReactiveFormsModule import), so TestBed needs no extra providers.
 */
import { TestBed } from '@angular/core/testing';
import { OrderMedicationFormComponent } from './order-medication-form.component';
import type { CreateMedicationOrderRequest } from '@caregiver/contracts';

describe('OrderMedicationFormComponent', () => {
  function createForm() {
    TestBed.configureTestingModule({});
    const fixture = TestBed.createComponent(OrderMedicationFormComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  }

  const VALID_FORM = {
    patientId: 'pat-1',
    practitionerId: 'doc-1',
    medicationCode: 'MED-1',
    medicationDisplay: 'Amoxicillin',
    dosageInstructions: '500mg twice daily',
    route: 'oral',
    quantity: 30,
    refills: 2,
    priority: 'urgent' as const,
    reason: 'Bacterial infection',
    notes: 'Take with food',
  };

  it('emits a typed medication order request on valid submit', () => {
    const { component } = createForm();
    const emitSpy = spyOn(component.submitOrder, 'emit');

    component.form.setValue(VALID_FORM);
    component.onSubmit();

    expect(emitSpy).toHaveBeenCalledWith({
      patientId: 'pat-1',
      practitionerId: 'doc-1',
      orderType: 'medication',
      medicationCode: 'MED-1',
      medicationDisplay: 'Amoxicillin',
      dosageInstructions: '500mg twice daily',
      route: 'oral',
      quantity: 30,
      refills: 2,
      priority: 'urgent',
      reason: 'Bacterial infection',
      notes: 'Take with food',
    } satisfies CreateMedicationOrderRequest);
  });

  it('does not emit when required fields are missing', () => {
    const { component } = createForm();
    const emitSpy = spyOn(component.submitOrder, 'emit');

    // Empty form — required fields (patientId, practitionerId, medicationCode,
    // medicationDisplay, dosageInstructions) are all blank → invalid.
    component.onSubmit();

    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('does not emit when dosage instructions are missing', () => {
    const { component } = createForm();
    const emitSpy = spyOn(component.submitOrder, 'emit');

    component.form.patchValue({ ...VALID_FORM, dosageInstructions: '' });
    component.onSubmit();

    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('maps empty optional fields to undefined in the payload', () => {
    const { component } = createForm();
    const emitSpy = spyOn(component.submitOrder, 'emit');

    component.form.setValue({
      patientId: 'pat-1',
      practitionerId: 'doc-1',
      medicationCode: 'MED-1',
      medicationDisplay: 'Amoxicillin',
      dosageInstructions: '500mg twice daily',
      route: '',
      quantity: null,
      refills: null,
      priority: 'routine',
      reason: '',
      notes: '',
    });
    component.onSubmit();

    expect(emitSpy).toHaveBeenCalledWith(
      jasmine.objectContaining({
        orderType: 'medication',
        route: undefined,
        quantity: undefined,
        refills: undefined,
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
    expect(component.form.controls.medicationCode.value).toBe('');
    expect(component.form.controls.dosageInstructions.value).toBe('');
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
});
