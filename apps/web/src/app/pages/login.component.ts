/**
 * apps/web/src/app/pages/login.component.ts
 *
 * Login page — standalone component with reactive form.
 *
 * On successful login, stores tokens via AuthService and navigates
 * to the dashboard (or the return URL if redirected from a protected route).
 */
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../services/auth.service.js';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="login-container">
      <div class="login-card">
        <h1>Caregiver</h1>
        <p class="login-subtitle">Healthcare Intelligence Platform</p>

        <!-- Login form — reactive form with validation. -->
        <form [formGroup]="loginForm" (ngSubmit)="onSubmit()">
          <div class="form-field">
            <label for="email">Email</label>
            <input
              id="email"
              type="email"
              formControlName="email"
              placeholder="you@hospital.com"
              [class.error]="loginForm.controls.email.invalid && loginForm.controls.email.touched"
            />
            @if (loginForm.controls.email.invalid && loginForm.controls.email.touched) {
              <span class="field-error">Email is required</span>
            }
          </div>

          <div class="form-field">
            <label for="password">Password</label>
            <input
              id="password"
              type="password"
              formControlName="password"
              placeholder="••••••••"
              [class.error]="loginForm.controls.password.invalid && loginForm.controls.password.touched"
            />
            @if (loginForm.controls.password.invalid && loginForm.controls.password.touched) {
              <span class="field-error">Password is required</span>
            }
          </div>

          <!-- Submit button — disabled while loading. -->
          <button type="submit" [disabled]="loading()" class="login-btn">
            {{ loading() ? 'Signing in...' : 'Sign In' }}
          </button>

          <!-- Error message — shown on login failure. -->
          @if (errorMessage()) {
            <div class="login-error">{{ errorMessage() }}</div>
          }
        </form>
      </div>
    </div>
  `,
  styles: [`
    .login-container {
      display: flex; align-items: center; justify-content: center;
      min-height: calc(100vh - 64px); padding: 2rem;
    }
    .login-card {
      width: 100%; max-width: 400px; padding: 2.5rem;
      background: white; border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    h1 { margin: 0; color: #1a237e; font-size: 2rem; }
    .login-subtitle { margin: 0.25rem 0 2rem; color: #666; font-size: 0.9rem; }
    .form-field { margin-bottom: 1.25rem; }
    .form-field label { display: block; margin-bottom: 0.4rem; font-weight: 500; font-size: 0.875rem; }
    .form-field input {
      width: 100%; padding: 0.6rem 0.8rem; border: 1px solid #ddd;
      border-radius: 4px; font-size: 1rem; box-sizing: border-box;
    }
    .form-field input.error { border-color: #d32f2f; }
    .field-error { display: block; margin-top: 0.25rem; color: #d32f2f; font-size: 0.75rem; }
    .login-btn {
      width: 100%; padding: 0.7rem; background: #1a237e; color: white;
      border: none; border-radius: 4px; font-size: 1rem; cursor: pointer;
    }
    .login-btn:hover:not(:disabled) { background: #283593; }
    .login-btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .login-error {
      margin-top: 1rem; padding: 0.75rem; background: #ffebee;
      border: 1px solid #ef9a9a; border-radius: 4px; color: #c62828;
      font-size: 0.875rem;
    }
  `],
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // Reactive form with email + password validation.
  readonly loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  // Loading state (signal — Angular 17+ reactive state).
  readonly loading = signal(false);

  // Error message (signal — cleared on each submit attempt).
  readonly errorMessage = signal<string | null>(null);

  /**
   * Handle form submission.
   * Calls the auth service login API and handles the response.
   */
  async onSubmit(): Promise<void> {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    try {
      const response = await this.authService.login({
        email: this.loginForm.controls.email.value,
        password: this.loginForm.controls.password.value,
      }).toPromise();

      if (response) {
        this.authService.handleLoginSuccess(response);

        // Check for a return URL (if redirected from a protected route).
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        void this.router.navigate([returnUrl ?? '/dashboard']);
      }
    } catch {
      this.errorMessage.set('Invalid email or password. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }
}
