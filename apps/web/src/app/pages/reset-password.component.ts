/**
 * apps/web/src/app/pages/reset-password.component.ts
 *
 * Reset Password page — enter new password with a reset token.
 */
import { Component, inject, signal, type OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <h1>Set New Password</h1>
        <p class="auth-subtitle">Enter your new password below.</p>

        @if (!token()) {
          <div class="error-banner">
            Invalid or missing reset token. Please request a new reset link.
          </div>
          <a routerLink="/forgot-password" class="back-link">Request new reset link</a>
        }

        @if (token() && !success()) {
          <form [formGroup]="passwordForm" (ngSubmit)="onSubmit()">
            <div class="form-field">
              <label for="newPassword">New Password</label>
              <input
                id="newPassword"
                type="password"
                formControlName="newPassword"
                placeholder="Min. 8 characters"
              />
            </div>
            <div class="form-field">
              <label for="confirmPassword">Confirm Password</label>
              <input id="confirmPassword" type="password" formControlName="confirmPassword" />
            </div>
            @if (error()) {
              <div class="error-msg">{{ error() }}</div>
            }
            <button type="submit" [disabled]="submitting()" class="primary-btn w-full">
              {{ submitting() ? 'Resetting...' : 'Reset Password' }}
            </button>
          </form>
        }

        @if (success()) {
          <div class="success-banner">
            Password reset successfully! You can now log in with your new password.
          </div>
          <a routerLink="/login" class="back-link">Go to login</a>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .auth-page {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: calc(100vh - 64px);
        padding: 2rem;
      }
      .auth-card {
        width: 100%;
        max-width: 400px;
        padding: 2.5rem;
        background: var(--color-surface);
        border-radius: 8px;
        box-shadow: var(--shadow-lg);
      }
      h1 {
        margin: 0;
        color: var(--color-primary);
        font-size: 1.5rem;
      }
      .auth-subtitle {
        margin: 0.5rem 0 2rem;
        color: var(--color-text-secondary);
        font-size: 0.9rem;
      }
      .form-field {
        margin-bottom: 1.25rem;
      }
      .form-field label {
        display: block;
        margin-bottom: 0.4rem;
        font-weight: 500;
        font-size: 0.875rem;
      }
      .form-field input {
        width: 100%;
        padding: 0.6rem 0.8rem;
        border: 1px solid var(--color-border);
        border-radius: 4px;
        font-size: 1rem;
        box-sizing: border-box;
        background: var(--color-white);
        color: var(--color-text-primary);
      }
      .error-banner {
        padding: 0.75rem;
        background: var(--color-error-bg);
        border: 1px solid var(--color-error-border);
        border-radius: 4px;
        color: var(--color-error);
        font-size: 0.875rem;
        margin-bottom: 1rem;
      }
      .error-msg {
        margin-bottom: 1rem;
        padding: 0.5rem;
        background: var(--color-error-bg);
        border-radius: 4px;
        color: var(--color-error);
        font-size: 0.8rem;
      }
      .success-banner {
        margin-bottom: 1rem;
        padding: 0.75rem;
        background: var(--color-success-bg);
        border: 1px solid var(--color-success-border);
        border-radius: 4px;
        color: var(--color-success);
        font-size: 0.875rem;
      }
      .back-link {
        display: block;
        text-align: center;
        margin-top: 1.5rem;
        font-size: 0.875rem;
        color: var(--color-accent);
      }
      .w-full {
        width: 100%;
      }
    `,
  ],
})
export class ResetPasswordComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly token = signal<string | null>(null);
  readonly submitting = signal(false);
  readonly success = signal(false);
  readonly error = signal<string | null>(null);

  readonly passwordForm = this.fb.nonNullable.group({
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required]],
  });

  ngOnInit(): void {
    this.token.set(this.route.snapshot.queryParamMap.get('token'));
  }

  async onSubmit(): Promise<void> {
    if (this.passwordForm.invalid) return;
    const fv = this.passwordForm.getRawValue();
    if (fv.newPassword !== fv.confirmPassword) {
      this.error.set('Passwords do not match.');
      return;
    }

    this.submitting.set(true);
    this.error.set(null);
    try {
      await this.http
        .post('/api/auth/reset-password', { token: this.token(), newPassword: fv.newPassword })
        .toPromise();
      this.success.set(true);
      setTimeout(() => this.router.navigate(['/login']), 3000);
    } catch {
      this.error.set('Failed to reset password. The link may have expired.');
    } finally {
      this.submitting.set(false);
    }
  }
}
