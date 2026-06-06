import { Injectable, computed, signal } from '@angular/core';
import { Claim, Invoice, Timesheet } from '../models/billing.model';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from './api.config';

@Injectable({ providedIn: 'root' })
export class BillingService {
  private readonly _invoices = signal<Invoice[]>([]);
  private readonly _claims = signal<Claim[]>([]);
  private readonly _timesheets = signal<Timesheet[]>([]);
  readonly invoices = this._invoices.asReadonly();
  readonly claims = this._claims.asReadonly();
  readonly timesheets = this._timesheets.asReadonly();

  readonly totalRevenue = computed<number>(() =>
    this._invoices().filter((i) => i.status === 'paid').reduce((sum, i) => sum + i.total, 0),
  );
  readonly totalOutstanding = computed<number>(() =>
    this._invoices().filter((i) => i.status === 'sent' || i.status === 'overdue').reduce((sum, i) => sum + i.total, 0),
  );
  readonly overdueCount = computed<number>(() => this._invoices().filter((i) => i.status === 'overdue').length);

  readonly deniedClaims = computed<Claim[]>(() => this._claims().filter((c) => c.status === 'denied' || c.status === 'appealed'));
  readonly queuedClaims = computed<Claim[]>(() => this._claims().filter((c) => c.status === 'queued' || c.status === 'submitted'));
  readonly paidClaims = computed<Claim[]>(() => this._claims().filter((c) => c.status === 'paid'));

  readonly pendingTimesheets = computed<Timesheet[]>(() => this._timesheets().filter((t) => t.status === 'open' || t.status === 'submitted'));

  constructor(private readonly http: HttpClient) {
    this.load();
  }

  load(): void {
    this.http.get<Invoice[]>(`${API_BASE_URL}/invoices`).subscribe({
      next: (data) => this._invoices.set(data),
      error: (err) => console.error('Failed to load invoices', err),
    });
    this.http.get<Claim[]>(`${API_BASE_URL}/claims`).subscribe({
      next: (data) => this._claims.set(data),
      error: (err) => console.error('Failed to load claims', err),
    });
    this.http.get<Timesheet[]>(`${API_BASE_URL}/timesheets`).subscribe({
      next: (data) => this._timesheets.set(data),
      error: (err) => console.error('Failed to load timesheets', err),
    });
  }

  approveTimesheet(id: string, approverId: string): void {
    // Optimistic Update
    this._timesheets.update((l) => l.map((t) => (t.id === id ? { ...t, status: 'approved', approverId } : t)));
    
    this.http.put<Timesheet>(`${API_BASE_URL}/timesheets/${id}`, { status: 'approved', approverId }).subscribe({
      error: (err) => {
        console.error('Failed to approve timesheet', err);
        this.load();
      }
    });
  }

  submitTimesheet(id: string): void {
    // Optimistic Update
    this._timesheets.update((l) => l.map((t) => (t.id === id ? { ...t, status: 'submitted' } : t)));

    this.http.put<Timesheet>(`${API_BASE_URL}/timesheets/${id}`, { status: 'submitted' }).subscribe({
      error: (err) => {
        console.error('Failed to submit timesheet', err);
        this.load();
      }
    });
  }

  submitClaim(id: string): void {
    // Optimistic Update
    const nowStr = new Date().toISOString();
    this._claims.update((l) => l.map((c) => (c.id === id ? { ...c, status: 'submitted', submittedAt: nowStr } : c)));

    this.http.put<Claim>(`${API_BASE_URL}/claims/${id}`, { status: 'submitted', submittedAt: nowStr }).subscribe({
      error: (err) => {
        console.error('Failed to submit claim', err);
        this.load();
      }
    });
  }

  addInvoice(invoice: Invoice): void {
    // Optimistic Update
    this._invoices.update((l) => [invoice, ...l]);

    this.http.post<Invoice>(`${API_BASE_URL}/invoices`, invoice).subscribe({
      error: (err) => {
        console.error('Failed to create invoice on backend', err);
        this.load();
      }
    });
  }

  markInvoicePaid(id: string): void {
    // Optimistic Update
    this._invoices.update((l) => l.map((i) => (i.id === id ? { ...i, status: 'paid' } : i)));
  }
}
