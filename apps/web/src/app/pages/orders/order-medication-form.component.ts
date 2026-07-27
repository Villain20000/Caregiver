/**
 * apps/web/src/app/pages/orders/order-medication-form.component.ts
 *
 * Presentational form for creating a medication order.
 */
import { Component, effect, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import type { CreateMedicationOrderRequest } from '@caregiver/contracts';

@Component({
  selector: 'app-order-medication-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="onSubmit()">
      <div class="form-row">
        <div class="form-field">
          <label for="patientId">Patient ID</label>
          <input id="patientId" type="text" formControlName="patientId" />
        </div>
        <div class="form-field">
          <label for="practitionerId">Practitioner ID</label>
          <input id="practitionerId" type="text" formControlName="practitionerId" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-field">
          <label for="medicationCode">Medication Code</label>
          <input id="medicationCode" type="text" formControlName="medicationCode" />
        </div>
        <div class="form-field">
          <label for="medicationDisplay">Medication Name</label>
          <input id="medicationDisplay" type="text" formControlName="medicationDisplay" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-field">
          <label for="dosageInstructions">Dosage Instructions</label>
          <input id="dosageInstructions" type="text" formControlName="dosageInstructions" />
        </div>
        <div class="form-field">
          <label for="route">Route</label>
          <input id="route" type="text" formControlName="route" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-field">
          <label for="quantity">Quantity</label>
          <input id="quantity" type="number" formControlName="quantity" />
        </div>
        <div class="form-field">
          <label for="refills">Refills</label>
          <input id="refills" type="number" formControlName="refills" />
        </div>
        <div class="form-field">
          <label for="priority">Priority</label>
          <select id="priority" formControlName="priority">
            <option value="routine">Routine</option>
            <option value="urgent">Urgent</option>
            <option value="asap">ASAP</option>
            <option value="stat">STAT</option>
          </select>
        </div>
      </div>
      <div class="form-field">
        <label for="reason">Reason</label>
        <input id="reason" type="text" formControlName="reason" />
      </div>
      <div class="form-field">
        <label for="notes">Notes</label>
        <input id="notes" type="text" formControlName="notes" />
      </div>
      <button type="submit" [disabled]="submitting()" class="primary-btn">
        {{ submitting() ? 'Creating...' : 'Create Medication Order' }}
      </button>
    </form>
  `,
  styles: [`
    .form-row { display: flex; gap: 1rem; margin-bottom: 1rem; }
    .form-field { flex: 1; }
    .form-field label { display: block; margin-bottom: 0.3rem; font-size: 0.8rem; font-weight: 500; }
    .form-field input, .form-field select {
      width: 100%; padding: 0.5rem; border: 1px solid #ddd;
      border-radius: 4px; box-sizing: border-box;
    }
    .primary-btn {
      padding: 0.6rem 1.5rem; background: #1a237e; color: white;
      border: none; border-radius: 4px; cursor: pointer;
    }
    .primary-btn:disabled { opacity: 0.6; cursor: not-allowed; }
  `],
})
export class OrderMedicationFormComponent {
  private readonly fb = inject(FormBuilder);

  readonly submitting = input<boolean>(false);

  /** Incremented by the parent after a successful creation to reset the form. */
  readonly resetTick = input<number>(0);

  readonly submitOrder = output<CreateMedicationOrderRequest>();

  constructor() {
    effect(() => {
      this.resetTick();
      this.form.reset();
    });
  }

  readonly form = this.fb.nonNullable.group({
    patientId: ['', [Validators.required]],
    practitionerId: ['', [Validators.required]],
    medicationCode: ['', [Validators.required]],
    medicationDisplay: ['', [Validators.required]],
    dosageInstructions: ['', [Validators.required]],
    route: [''],
    quantity: this.fb.nonNullable.control<number | null>(null),
    refills: this.fb.nonNullable.control<number | null>(null),
    priority: this.fb.nonNullable.control<'routine' | 'urgent' | 'asap' | 'stat'>('routine', [Validators.required]),
    reason: [''],
    notes: [''],
  });

  onSubmit(): void {
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    this.submitOrder.emit({
      ...value,
      orderType: 'medication',
      route: value.route || undefined,
      quantity: value.quantity ?? undefined,
      refills: value.refills ?? undefined,
      reason: value.reason || undefined,
      notes: value.notes || undefined,
    });
  }
}
