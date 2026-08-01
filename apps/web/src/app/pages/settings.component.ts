/**
 * apps/web/src/app/pages/settings.component.ts
 *
 * Settings page — password change, session management, theme toggle.
 */
import { Component, inject, signal, type OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ThemeService } from '../services/theme.service.js';

interface Session {
  id: string;
  createdAt: string;
  expiresAt: string;
  current: boolean;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="page">
      <h1>Settings</h1>
      <p class="page-subtitle">Manage your account, security, and preferences.</p>

      @if (error()) {
        <div class="error-banner">{{ error() }}</div>
      }

      <!-- Theme -->
      <div class="form-section">
        <h2>Appearance</h2>
        <div class="theme-toggle">
          <span class="theme-label">Theme</span>
          <div class="theme-options">
            <button
              class="theme-option"
              [class.active]="!themeService.isDark()"
              (click)="themeService.setTheme('light')"
            >
              ☀️ Light
            </button>
            <button
              class="theme-option"
              [class.active]="themeService.isDark()"
              (click)="themeService.setTheme('dark')"
            >
              🌙 Dark
            </button>
          </div>
        </div>
      </div>

      <!-- Change Password -->
      <div class="form-section">
        <h2>Change Password</h2>
        <form [formGroup]="passwordForm" (ngSubmit)="onChangePassword()">
          <div class="form-field">
            <label for="currentPassword">Current Password</label>
            <input id="currentPassword" type="password" formControlName="currentPassword" />
          </div>
          <div class="form-row">
            <div class="form-field">
              <label for="newPassword">New Password</label>
              <input id="newPassword" type="password" formControlName="newPassword" />
            </div>
            <div class="form-field">
              <label for="confirmPassword">Confirm New Password</label>
              <input id="confirmPassword" type="password" formControlName="confirmPassword" />
            </div>
          </div>
          @if (passwordError()) {
            <div class="field-error">{{ passwordError() }}</div>
          }
          @if (passwordSuccess()) {
            <div class="success-msg">{{ passwordSuccess() }}</div>
          }
          <button type="submit" [disabled]="changingPassword()" class="primary-btn">
            {{ changingPassword() ? 'Changing...' : 'Change Password' }}
          </button>
        </form>
      </div>

      <!-- Sessions -->
      <div class="form-section">
        <div class="section-header">
          <h2>Active Sessions</h2>
          <button (click)="onRevokeAll()" class="danger-btn" [disabled]="sessions().length === 0">
            Log Out All Sessions
          </button>
        </div>
        <p class="field-hint">Sessions where your account is currently logged in.</p>

        @if (sessionsLoading()) {
          <div class="loading">Loading sessions...</div>
        }

        @if (!sessionsLoading() && sessions().length > 0) {
          <div class="sessions-list">
            @for (session of sessions(); track session.id) {
              <div class="session-card" [class.current]="session.current">
                <div class="session-info">
                  <span class="session-badge">
                    @if (session.current) {
                      Current session
                    } @else {
                      Active
                    }
                  </span>
                  <span class="session-date">Since {{ session.createdAt | date: 'medium' }}</span>
                  <span class="session-expiry"
                    >Expires {{ session.expiresAt | date: 'medium' }}</span
                  >
                </div>
                @if (!session.current) {
                  <button (click)="onRevoke(session.id)" class="action-btn">Revoke</button>
                }
              </div>
            }
          </div>
        }

        @if (!sessionsLoading() && sessions().length === 0) {
          <div class="empty-state">No active sessions found.</div>
        }

        @if (sessionsError()) {
          <div class="error-msg">{{ sessionsError() }}</div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .page {
        max-width: 800px;
        margin: 0 auto;
      }
      h1 {
        color: var(--color-primary);
      }
      .page-subtitle {
        color: var(--color-text-secondary);
        margin-top: 0;
      }
      .form-section {
        margin-top: 1.5rem;
        padding: 1.5rem;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 8px;
      }
      .form-section h2 {
        margin-top: 0;
        margin-bottom: 1rem;
        color: var(--color-text-primary);
        font-size: 1.1rem;
      }
      .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
      }
      .section-header h2 {
        margin-bottom: 0;
      }
      .form-field {
        margin-bottom: 1rem;
      }
      .form-field label {
        display: block;
        margin-bottom: 0.3rem;
        font-size: 0.8rem;
        font-weight: 500;
        color: var(--color-text-secondary);
      }
      .form-field input {
        width: 100%;
        padding: 0.5rem;
        border: 1px solid var(--color-border);
        border-radius: 4px;
        box-sizing: border-box;
        background: var(--color-white);
        color: var(--color-text-primary);
      }
      .form-row {
        display: flex;
        gap: 1rem;
      }
      .field-error {
        color: var(--color-error);
        font-size: 0.8rem;
        margin-bottom: 0.5rem;
      }
      .field-hint {
        color: var(--color-text-muted);
        font-size: 0.8rem;
        margin-bottom: 1rem;
      }
      .success-msg {
        color: var(--color-success);
        font-size: 0.8rem;
        margin-bottom: 0.5rem;
        padding: 0.5rem;
        background: var(--color-success-bg);
        border-radius: 4px;
      }
      .error-msg {
        color: var(--color-error);
        font-size: 0.8rem;
        margin-bottom: 0.5rem;
      }
      .theme-toggle {
        display: flex;
        align-items: center;
        gap: 1rem;
      }
      .theme-label {
        font-weight: 500;
        font-size: 0.9rem;
      }
      .theme-options {
        display: flex;
        gap: 0.5rem;
      }
      .theme-option {
        padding: 0.5rem 1rem;
        border: 1px solid var(--color-border);
        border-radius: 6px;
        background: var(--color-surface);
        cursor: pointer;
        font-size: 0.85rem;
        transition: all 0.15s;
      }
      .theme-option.active {
        background: var(--color-primary);
        color: white;
        border-color: var(--color-primary);
      }
      .theme-option:hover:not(.active) {
        background: var(--color-fill-hover);
      }
      .sessions-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .session-card {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.75rem 1rem;
        background: var(--color-fill-hover);
        border-radius: 6px;
        border: 1px solid transparent;
      }
      .session-card.current {
        border-color: var(--color-primary);
      }
      .session-info {
        display: flex;
        gap: 0.75rem;
        align-items: center;
        flex-wrap: wrap;
      }
      .session-badge {
        padding: 0.15rem 0.4rem;
        border-radius: 4px;
        font-size: 0.7rem;
        font-weight: 600;
        text-transform: uppercase;
        background: var(--color-primary-bg);
        color: var(--color-primary);
      }
      .session-date,
      .session-expiry {
        font-size: 0.8rem;
        color: var(--color-text-muted);
      }
      .loading,
      .empty-state {
        text-align: center;
        color: var(--color-text-muted);
        padding: 2rem;
      }

      @media (max-width: 768px) {
        .form-row {
          flex-direction: column;
        }
        .session-card {
          flex-direction: column;
          gap: 0.5rem;
          align-items: flex-start;
        }
        .section-header {
          flex-direction: column;
          align-items: flex-start;
          gap: 0.5rem;
        }
      }
    `,
  ],
})
export class SettingsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  readonly themeService = inject(ThemeService);

  readonly error = signal<string | null>(null);
  readonly changingPassword = signal(false);
  readonly passwordError = signal<string | null>(null);
  readonly passwordSuccess = signal<string | null>(null);
  readonly sessions = signal<Session[]>([]);
  readonly sessionsLoading = signal(false);
  readonly sessionsError = signal<string | null>(null);

  readonly passwordForm = this.fb.nonNullable.group({
    currentPassword: ['', [Validators.required]],
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required]],
  });

  ngOnInit(): void {
    this.loadSessions();
  }

  async onChangePassword(): Promise<void> {
    if (this.passwordForm.invalid) return;

    const fv = this.passwordForm.getRawValue();
    if (fv.newPassword !== fv.confirmPassword) {
      this.passwordError.set('Passwords do not match.');
      return;
    }

    this.changingPassword.set(true);
    this.passwordError.set(null);
    this.passwordSuccess.set(null);

    try {
      await this.http
        .post('/api/auth/change-password', {
          currentPassword: fv.currentPassword,
          newPassword: fv.newPassword,
        })
        .toPromise();
      this.passwordSuccess.set('Password changed successfully.');
      this.passwordForm.reset();
    } catch {
      this.passwordError.set('Failed to change password. Check your current password.');
    } finally {
      this.changingPassword.set(false);
    }
  }

  async loadSessions(): Promise<void> {
    this.sessionsLoading.set(true);
    this.sessionsError.set(null);
    try {
      const sessions = await this.http.get<Session[]>('/api/auth/sessions').toPromise();
      this.sessions.set(sessions ?? []);
    } catch {
      this.sessionsError.set('Failed to load sessions.');
    } finally {
      this.sessionsLoading.set(false);
    }
  }

  async onRevoke(sessionId: string): Promise<void> {
    try {
      await this.http.delete(`/api/auth/sessions/${sessionId}`).toPromise();
      this.sessions.update((prev) => prev.filter((s) => s.id !== sessionId));
    } catch {
      this.error.set('Failed to revoke session.');
    }
  }

  async onRevokeAll(): Promise<void> {
    try {
      await this.http.delete('/api/auth/sessions').toPromise();
      this.sessions.set([]);
    } catch {
      this.error.set('Failed to revoke all sessions.');
    }
  }
}
