/**
 * apps/web/src/app/pages/orders/order-imaging-form.component.ts
 *
 * Presentational form for creating an imaging order.
 */
import { Component, effect, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import type { CreateImagingOrderRequest } from '@caregiver/contracts';

@Component({
  selector: 'app-order-imaging-form',
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
          <label for="code">Code</label>
          <input id="code" type="text" formControlName="code" />
        </div>
        <div class="form-field">
          <label for="display">Display Name</label>
          <input id="display" type="text" formControlName="display" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-field">
          <label for="bodySite">Body Site</label>
          <input id="bodySite" type="text" formControlName="bodySite" />
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
        {{ submitting() ? 'Creating...' : 'Create Imaging Order' }}
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
export class OrderImagingFormComponent {
  private readonly fb = inject(FormBuilder);

  readonly submitting = input<boolean>(false);

  /** Incremented by the parent after a successful creation to reset the form. */
  readonly resetTick = input<number>(0);

  readonly submitOrder = output<CreateImagingOrderRequest>();

  constructor() {
    effect(() => {
      this.resetTick();
      this.form.reset();
    });
  }

  readonly form = this.fb.nonNullable.group({
    patientId: ['', [Validators.required]],
    practitionerId: ['', [Validators.required]],
    code: ['', [Validators.required]],
    display: ['', [Validators.required]],
    bodySite: [''],
    priority: this.fb.nonNullable.control<'routine' | 'urgent' | 'asap' | 'stat'>('routine', [Validators.required]),
    reason: [''],
    notes: [''],
  });

  onSubmit(): void {
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    this.submitOrder.emit({
      ...value,
      orderType: 'imaging',
      bodySite: value.bodySite || undefined,
      reason: value.reason || undefined,
      notes: value.notes || undefined,
    });
  }
}
