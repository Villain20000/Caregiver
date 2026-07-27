/**
 * apps/web/src/app/pages/billing/billing-create-claim.component.ts
 *
 * Create-claim form component.
 *
 * Allows authorized users to build an claim with one or more line items,
 * then emits a typed CreateClaimRequest to the parent page.
 */
import { Component, effect, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators, FormArray, type FormGroup } from '@angular/forms';
import type { CreateClaimRequest } from '@caregiver/contracts';

@Component({
  selector: 'app-billing-create-claim',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="form-section">
      <h2>Create Claim</h2>
      <form [formGroup]="claimForm" (ngSubmit)="onSubmit()">
        <div class="form-row">
          <div class="form-field">
            <label for="patientId">Patient ID</label>
            <input id="patientId" type="text" formControlName="patientId" />
          </div>
          <div class="form-field">
            <label for="providerId">Provider ID</label>
            <input id="providerId" type="text" formControlName="providerId" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-field">
            <label for="insurerId">Insurer ID</label>
            <input id="insurerId" type="text" formControlName="insurerId" />
          </div>
          <div class="form-field">
            <label for="type">Type</label>
            <select id="type" formControlName="type">
              <option value="professional">Professional</option>
              <option value="institutional">Institutional</option>
              <option value="pharmacy">Pharmacy</option>
              <option value="oral">Oral</option>
            </select>
          </div>
          <div class="form-field">
            <label for="use">Use</label>
            <select id="use" formControlName="use">
              <option value="claim">Claim</option>
              <option value="preauthorization">Preauthorization</option>
              <option value="predetermination">Predetermination</option>
            </select>
          </div>
        </div>

        <div class="items-section" formArrayName="items">
          <h3>Line Items</h3>
          @for (item of items.controls; track $index) {
            <div class="form-row" [formGroupName]="$index">
              <div class="form-field">
                <label [for]="'serviceDate-' + $index">Service Date</label>
                <input [id]="'serviceDate-' + $index" type="date" formControlName="serviceDate" />
              </div>
              <div class="form-field">
                <label [for]="'code-' + $index">Code</label>
                <input [id]="'code-' + $index" type="text" formControlName="code" />
              </div>
              <div class="form-field">
                <label [for]="'codeSystem-' + $index">Code System</label>
                <input [id]="'codeSystem-' + $index" type="text" formControlName="codeSystem" />
              </div>
              <div class="form-field">
                <label [for]="'display-' + $index">Display</label>
                <input [id]="'display-' + $index" type="text" formControlName="display" />
              </div>
              <div class="form-field small">
                <label [for]="'quantity-' + $index">Qty</label>
                <input [id]="'quantity-' + $index" type="number" formControlName="quantity" />
              </div>
              <div class="form-field small">
                <label [for]="'unitPrice-' + $index">Unit Price</label>
                <input [id]="'unitPrice-' + $index" type="number" formControlName="unitPrice" />
              </div>
              <button type="button" (click)="removeItem($index)" class="remove-btn">&times;</button>
            </div>
          }
          <button type="button" (click)="addItem()" class="action-btn">Add Line Item</button>
        </div>

        <button type="submit" [disabled]="processing()" class="create-btn">
          {{ processing() ? 'Creating...' : 'Create Claim' }}
        </button>
      </form>
    </div>
  `,
  styles: [`
    .form-section {
      margin-top: 1.5rem; padding: 1.5rem; background: white;
      border: 1px solid #e0e0e0; border-radius: 8px;
    }
    h2 { margin-top: 0; color: #333; font-size: 1.1rem; }
    .items-section { margin: 1rem 0; padding: 1rem; background: #fafafa; border-radius: 6px; }
    .items-section h3 { margin-top: 0; font-size: 1rem; color: #333; }
    .form-row { display: flex; gap: 1rem; margin-bottom: 1rem; align-items: flex-end; }
    .form-field { flex: 1; }
    .form-field.small { flex: 0 0 100px; }
    .form-field label { display: block; margin-bottom: 0.3rem; font-size: 0.8rem; font-weight: 500; }
    .form-field input, .form-field select {
      width: 100%; padding: 0.5rem; border: 1px solid #ddd;
      border-radius: 4px; box-sizing: border-box;
    }
    .create-btn, .action-btn {
      padding: 0.6rem 1.5rem; background: #1a237e; color: white;
      border: none; border-radius: 4px; cursor: pointer;
    }
    .action-btn { background: white; color: #1a237e; border: 1px solid #1a237e; }
    .create-btn:disabled { opacity: 0.6; }
    .remove-btn {
      background: #ffebee; color: #c62828; border: 1px solid #ef9a9a;
      border-radius: 4px; cursor: pointer; padding: 0 0.5rem; font-size: 1.2rem; line-height: 1.5;
    }
  `],
})
export class BillingCreateClaimComponent {
  private readonly fb = inject(FormBuilder);

  /** True while the parent is processing the creation request. */
  readonly processing = input<boolean>(false);

  /** Incremented by the parent after a successful creation to reset the form. */
  readonly resetTick = input<number>(0);

  /** Emits a ready-to-submit CreateClaimRequest. */
  readonly createClaim = output<CreateClaimRequest>();

  readonly claimForm = this.fb.nonNullable.group({
    patientId: ['', [Validators.required]],
    providerId: ['', [Validators.required]],
    insurerId: ['', [Validators.required]],
    type: this.fb.nonNullable.control<'professional' | 'institutional' | 'pharmacy' | 'oral'>('professional', [Validators.required]),
    use: this.fb.nonNullable.control<'claim' | 'preauthorization' | 'predetermination'>('claim', [Validators.required]),
    items: this.fb.array<FormGroup>([this.createItemGroup()]),
  });

  constructor() {
    // Reset the form after a successful creation.
    effect(() => {
      this.resetTick();
      this.claimForm.reset({ type: 'professional', use: 'claim' });
      this.claimForm.setControl('items', this.fb.array<FormGroup>([this.createItemGroup()]));
    });
  }

  /** Access the line items FormArray. */
  get items(): FormArray {
    return this.claimForm.get('items') as FormArray;
  }

  /** Add a blank line item. */
  addItem(): void {
    this.items.push(this.createItemGroup());
  }

  /** Remove a line item by index. */
  removeItem(index: number): void {
    this.items.removeAt(index);
  }

  /** Validate and emit the current claim. */
  onSubmit(): void {
    if (this.claimForm.invalid) return;
    const fv = this.claimForm.getRawValue();
    const items = fv.items.map((item) => ({
      serviceDate: item.serviceDate,
      code: item.code,
      codeSystem: item.codeSystem,
      display: item.display,
      quantity: item.quantity ?? 0,
      unitPrice: item.unitPrice ?? 0,
      netAmount: (item.quantity ?? 0) * (item.unitPrice ?? 0),
    }));
    this.createClaim.emit({
      patientId: fv.patientId,
      providerId: fv.providerId,
      insurerId: fv.insurerId,
      type: fv.type,
      use: fv.use,
      items,
    });
  }

  private createItemGroup(): FormGroup {
    return this.fb.nonNullable.group({
      serviceDate: ['', [Validators.required]],
      code: ['', [Validators.required]],
      codeSystem: [''],
      display: ['', [Validators.required]],
      quantity: this.fb.nonNullable.control<number | null>(null, [Validators.required]),
      unitPrice: this.fb.nonNullable.control<number | null>(null, [Validators.required]),
    });
  }
}
