/**
 * apps/web/src/app/pages/forgot-password.component.ts
 *
 * Forgot Password page — enter email to receive reset link.
 */
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <h1>Reset Password</h1>
        <p class="auth-subtitle">Enter your email and we'll send you a reset link.</p>

        @if (submitted()) {
          <div class="success-banner">
            If an account with that email exists, a reset link has been sent.
          </div>
        }

        @if (!submitted()) {
          <form [formGroup]="emailForm" (ngSubmit)="onSubmit()">
            <div class="form-field">
              <label for="email">Email</label>
              <input
                id="email"
                type="email"
                formControlName="email"
                placeholder="you@hospital.com"
              />
            </div>
            @if (error()) {
              <div class="error-msg">{{ error() }}</div>
            }
            <button type="submit" [disabled]="submitting()" class="primary-btn w-full">
              {{ submitting() ? 'Sending...' : 'Send Reset Link' }}
            </button>
          </form>
        }

        <a routerLink="/login" class="back-link">Back to login</a>
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
export class ForgotPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);

  readonly emailForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });
  readonly submitting = signal(false);
  readonly submitted = signal(false);
  readonly error = signal<string | null>(null);

  async onSubmit(): Promise<void> {
    if (this.emailForm.invalid) return;
    this.submitting.set(true);
    this.error.set(null);
    try {
      await this.http
        .post('/api/auth/forgot-password', { email: this.emailForm.getRawValue().email })
        .toPromise();
      this.submitted.set(true);
    } catch {
      this.error.set('Failed to send reset link. Please try again.');
    } finally {
      this.submitting.set(false);
    }
  }
}
