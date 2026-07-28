/**
 * apps/web/src/app/pages/audit.component.ts
 *
 * Audit Trail page.
 *
 * Displays a filterable list of system audit log entries. Supports filtering by
 * user, resource type, and resource id.
 */
import { Component, inject, signal, type OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { AuthService } from '../services/auth.service.js';
import { AuditService } from '../services/audit.service.js';
import type { AuditResponse } from '@caregiver/contracts';

@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="page">
      <h1>Audit Trail</h1>
      <p class="page-subtitle">View system activity and compliance events.</p>

      @if (error()) {
        <div class="error-banner">{{ error() }}</div>
      }

      <div class="form-section">
        <h2>Filters</h2>
        <form [formGroup]="filterForm" (ngSubmit)="onSearch()">
          <div class="form-row">
            <div class="form-field">
              <label for="userId">User ID</label>
              <input id="userId" type="text" formControlName="userId" />
            </div>
            <div class="form-field">
              <label for="resourceType">Resource Type</label>
              <input
                id="resourceType"
                type="text"
                formControlName="resourceType"
                placeholder="e.g. Patient"
              />
            </div>
            <div class="form-field">
              <label for="resourceId">Resource ID</label>
              <input id="resourceId" type="text" formControlName="resourceId" />
            </div>
          </div>
          <button type="submit" [disabled]="loading()" class="create-btn">Search</button>
          <button type="button" (click)="onReset()" class="reset-btn">Reset</button>
        </form>
      </div>

      <div class="history-section">
        <h2>Audit Log</h2>
        @if (loading()) {
          <div class="loading">Loading audit logs...</div>
        }
        @if (!loading() && logs().length > 0) {
          <div class="table-wrap">
            <table class="audit-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Action</th>
                  <th>User</th>
                  <th>Role</th>
                  <th>Resource</th>
                  <th>Result</th>
                  <th>Service</th>
                </tr>
              </thead>
              <tbody>
                @for (log of logs(); track log.id) {
                  <tr [class.failure]="log.result === 'failure'">
                    <td>{{ log.occurredAt | date: 'short' }}</td>
                    <td>{{ log.action }}</td>
                    <td>{{ log.userId ?? '—' }}</td>
                    <td>{{ log.userRole ?? '—' }}</td>
                    <td>{{ log.resourceType ?? '—' }} {{ log.resourceId ?? '' }}</td>
                    <td>
                      <span class="result" [class]="log.result">{{ log.result }}</span>
                    </td>
                    <td>{{ log.serviceName }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
        @if (!loading() && logs().length === 0) {
          <div class="empty-state">No audit logs found.</div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .page {
        max-width: 1400px;
        margin: 0 auto;
      }
      h1 {
        color: #1a237e;
        margin-bottom: 0.25rem;
      }
      .page-subtitle {
        color: #666;
        margin-top: 0;
      }
      .error-banner {
        margin-top: 1rem;
        padding: 0.75rem;
        background: #ffebee;
        border: 1px solid #ef9a9a;
        border-radius: 4px;
        color: #c62828;
        font-size: 0.875rem;
      }
      .form-section,
      .history-section {
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
      .form-row {
        display: flex;
        gap: 1rem;
        margin-bottom: 1rem;
      }
      .form-field {
        flex: 1;
      }
      .form-field label {
        display: block;
        margin-bottom: 0.3rem;
        font-size: 0.8rem;
        font-weight: 500;
      }
      .form-field input {
        width: 100%;
        padding: 0.5rem;
        border: 1px solid #ddd;
        border-radius: 4px;
        box-sizing: border-box;
      }
      .create-btn,
      .reset-btn {
        padding: 0.6rem 1.5rem;
        background: #1a237e;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        margin-right: 0.5rem;
      }
      .reset-btn {
        background: #f5f5f5;
        color: #333;
        border: 1px solid #ddd;
      }
      .create-btn:disabled {
        opacity: 0.6;
      }
      .loading,
      .empty-state {
        text-align: center;
        color: #999;
        padding: 1rem;
      }
      .table-wrap {
        overflow-x: auto;
      }
      .audit-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 1rem;
        font-size: 0.875rem;
      }
      .audit-table th,
      .audit-table td {
        padding: 0.6rem;
        text-align: left;
        border-bottom: 1px solid #e0e0e0;
      }
      .audit-table th {
        background: #f5f5f5;
        color: #333;
        font-weight: 600;
      }
      .audit-table tr:hover {
        background: #fafafa;
      }
      .audit-table tr.failure {
        background: #ffebee;
      }
      .result {
        padding: 0.15rem 0.4rem;
        border-radius: 4px;
        font-size: 0.7rem;
        text-transform: uppercase;
        font-weight: 600;
      }
      .result.success {
        background: #e8f5e9;
        color: #2e7d32;
      }
      .result.failure {
        background: #ffebee;
        color: #c62828;
      }
    `,
  ],
})
export class AuditComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly auditService = inject(AuditService);

  readonly logs = signal<AuditResponse[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly filterForm = this.fb.nonNullable.group({
    userId: [''],
    resourceType: [''],
    resourceId: [''],
  });

  ngOnInit(): void {
    this.loadLogs();
  }

  async onSearch(): Promise<void> {
    const fv = this.filterForm.getRawValue();
    if (fv.userId) {
      await this.loadByUser(fv.userId);
    } else if (fv.resourceType && fv.resourceId) {
      await this.loadByResource(fv.resourceType, fv.resourceId);
    } else {
      await this.loadLogs();
    }
  }

  async onReset(): Promise<void> {
    this.filterForm.reset();
    await this.loadLogs();
  }

  private async loadLogs(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const logs = await this.auditService.listAuditLogs().toPromise();
      this.logs.set(logs ?? []);
    } catch {
      this.error.set('Failed to load audit logs.');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadByUser(userId: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const logs = await this.auditService.getByUser(userId).toPromise();
      this.logs.set(logs ?? []);
    } catch {
      this.error.set('Failed to load audit logs by user.');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadByResource(resourceType: string, resourceId: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const logs = await this.auditService.getByResource(resourceType, resourceId).toPromise();
      this.logs.set(logs ?? []);
    } catch {
      this.error.set('Failed to load audit logs by resource.');
    } finally {
      this.loading.set(false);
    }
  }
}
