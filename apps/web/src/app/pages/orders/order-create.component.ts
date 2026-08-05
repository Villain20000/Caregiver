/**
 * apps/web/src/app/pages/orders/order-create.component.ts
 *
 * Order creation wrapper.
 *
 * Shows a type selector (lab/imaging/medication) and renders the matching
 * presentational form. Forwards the emitted request up to the parent page.
 */
import { Component, effect, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { CreateOrderRequest } from '@caregiver/contracts';
import { OrderLabFormComponent } from './order-lab-form.component.js';
import { OrderImagingFormComponent } from './order-imaging-form.component.js';
import { OrderMedicationFormComponent } from './order-medication-form.component.js';

@Component({
  selector: 'app-order-create',
  standalone: true,
  imports: [
    CommonModule,
    OrderLabFormComponent,
    OrderImagingFormComponent,
    OrderMedicationFormComponent,
  ],
  template: `
    <div class="form-section">
      <h2>Create Order</h2>
      <div class="form-field">
        <label for="orderType">Order Type</label>
        <select id="orderType" [value]="selectedType()" (change)="selectType($event)">
          @for (type of allowedTypes(); track type) {
            <option [value]="type">{{ type | titlecase }}</option>
          }
        </select>
      </div>

      @switch (selectedType()) {
        @case ('lab') {
          <app-order-lab-form
            [submitting]="submitting()"
            [resetTick]="resetTick()"
            (submitOrder)="onSubmit($event)"
          />
        }
        @case ('imaging') {
          <app-order-imaging-form
            [submitting]="submitting()"
            [resetTick]="resetTick()"
            (submitOrder)="onSubmit($event)"
          />
        }
        @case ('medication') {
          <app-order-medication-form
            [submitting]="submitting()"
            [resetTick]="resetTick()"
            (submitOrder)="onSubmit($event)"
          />
        }
      }
    </div>
  `,
  styles: [
    `
      .form-section {
        margin-top: 1.5rem;
        padding: 1.5rem;
        background: white;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
      }
      h2 {
        margin-top: 0;
        color: #333;
        font-size: 1.1rem;
      }
      .form-field {
        margin-bottom: 1rem;
      }
      .form-field label {
        display: block;
        margin-bottom: 0.3rem;
        font-size: 0.8rem;
        font-weight: 500;
      }
      .form-field select {
        width: 100%;
        padding: 0.5rem;
        border: 1px solid #ddd;
        border-radius: 4px;
        box-sizing: border-box;
      }
    `,
  ],
})
export class OrderCreateComponent {
  /** Order types the current user may create. */
  readonly allowedTypes = input.required<Array<'lab' | 'imaging' | 'medication'>>();

  /** True while the parent is submitting. */
  readonly submitting = input<boolean>(false);

  /** Incremented by the parent after a successful creation to reset the form. */
  readonly resetTick = input<number>(0);

  /** Emits the selected order type's creation request. */
  readonly create = output<CreateOrderRequest>();

  /** Currently selected order type. */
  readonly selectedType = signal<'lab' | 'imaging' | 'medication'>('lab');

  constructor() {
    // Reset the type selector to the first allowed option when the parent
    // signals a successful creation or when the allowed list changes.
    // `allowSignalWrites` is required: the callback intentionally syncs the
    // `selectedType` signal with the incoming `allowedTypes`/`resetTick`
    // inputs (writing signals inside an effect is disallowed by default,
    // otherwise NG0600 is thrown at runtime).
    effect(
      () => {
        this.resetTick();
        const allowed = this.allowedTypes();
        this.selectedType.set(allowed[0] ?? 'lab');
      },
      { allowSignalWrites: true },
    );
  }

  /** Update the active order type from the dropdown. */
  selectType(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as 'lab' | 'imaging' | 'medication';
    this.selectedType.set(value);
  }

  /** Forward a form submission up to the parent. */
  onSubmit(request: CreateOrderRequest): void {
    this.create.emit(request);
  }
}
