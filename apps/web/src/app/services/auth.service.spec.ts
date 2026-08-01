/**
 * apps/web/src/app/services/auth.service.spec.ts
 *
 * Unit tests for AuthService — signal-based auth state, localStorage
 * session persistence, and token handling.
 *
 * AuthService injects HttpClient, Router, and AlertService; all three are
 * replaced with lightweight mocks via TestBed providers. The constructor
 * reads localStorage (restoreSession), so localStorage is cleared before
 * every test and a fresh service instance is created per test (TestBed
 * rebuilds the module each beforeEach).
 *
 * Note: imported without the `.js` extension. Both styles work in the karma
 * build — `.js` imports resolve via resolve.extensionAlias (see
 * karma.webpack.config.cjs).
 */
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { AlertService } from './alert.service';
import type { LoginRequest, LoginResponse, UserProfile } from '@caregiver/contracts';

describe('AuthService', () => {
  let httpSpy: jasmine.SpyObj<Pick<HttpClient, 'post'>>;
  let routerSpy: jasmine.SpyObj<Pick<Router, 'navigate'>>;
  let alertSpy: jasmine.SpyObj<Pick<AlertService, 'connect' | 'disconnect'>>;

  const mockUser: UserProfile = {
    id: 'user-1',
    email: 'dr.test@caregiver.io',
    fullName: 'Dr. Test',
    role: 'doctor',
    isActive: true,
  };

  const mockLoginResponse: LoginResponse = {
    accessToken: 'access-token-1',
    refreshToken: 'refresh-token-1',
    tokenType: 'Bearer',
    expiresIn: 900,
    user: mockUser,
  };

  beforeEach(() => {
    localStorage.clear();

    httpSpy = jasmine.createSpyObj('HttpClient', ['post']);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    routerSpy.navigate.and.returnValue(Promise.resolve(true));
    alertSpy = jasmine.createSpyObj('AlertService', ['connect', 'disconnect']);

    TestBed.configureTestingModule({
      providers: [
        { provide: HttpClient, useValue: httpSpy },
        { provide: Router, useValue: routerSpy },
        { provide: AlertService, useValue: alertSpy },
      ],
    });
  });

  /** Inject a fresh AuthService (its constructor reads localStorage). */
  function createService(): AuthService {
    return TestBed.inject(AuthService);
  }

  it('starts logged out when there is no stored session', () => {
    const service = createService();

    expect(service.currentUser()).toBeNull();
    expect(service.token()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
    expect(service.userRole()).toBeNull();
  });

  it('restores a session from localStorage on construction', () => {
    localStorage.setItem('caregiver_access_token', 'access-token-1');
    localStorage.setItem('caregiver_refresh_token', 'refresh-token-1');
    localStorage.setItem('caregiver_user', JSON.stringify(mockUser));

    const service = createService();

    expect(service.currentUser()).toEqual(mockUser);
    expect(service.token()).toBe('access-token-1');
    expect(service.isAuthenticated()).toBe(true);
    expect(service.userRole()).toBe('doctor');
    expect(alertSpy.connect).toHaveBeenCalled();
  });

  it('clears storage and stays logged out when the stored user JSON is corrupt', () => {
    localStorage.setItem('caregiver_access_token', 'access-token-1');
    localStorage.setItem('caregiver_refresh_token', 'refresh-token-1');
    localStorage.setItem('caregiver_user', '{not-valid-json');

    const service = createService();

    expect(service.isAuthenticated()).toBe(false);
    expect(service.token()).toBeNull();
    expect(localStorage.getItem('caregiver_access_token')).toBeNull();
    expect(localStorage.getItem('caregiver_refresh_token')).toBeNull();
    expect(localStorage.getItem('caregiver_user')).toBeNull();
  });

  it('posts credentials to the login endpoint', () => {
    httpSpy.post.and.returnValue(of(mockLoginResponse));
    const service = createService();

    const credentials: LoginRequest = { email: 'dr.test@caregiver.io', password: 's3cret' };
    let receivedToken: string | undefined;
    service.login(credentials).subscribe((response) => {
      receivedToken = response.accessToken;
    });

    expect(httpSpy.post).toHaveBeenCalledWith('/api/auth/login', credentials);
    expect(receivedToken).toBe('access-token-1');
  });

  it('stores tokens and navigates to the dashboard on login success', () => {
    const service = createService();

    service.handleLoginSuccess(mockLoginResponse);

    expect(service.token()).toBe('access-token-1');
    expect(service.currentUser()).toEqual(mockUser);
    expect(service.isAuthenticated()).toBe(true);

    expect(localStorage.getItem('caregiver_access_token')).toBe('access-token-1');
    expect(localStorage.getItem('caregiver_refresh_token')).toBe('refresh-token-1');
    expect(localStorage.getItem('caregiver_user')).toBe(JSON.stringify(mockUser));

    expect(alertSpy.connect).toHaveBeenCalled();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('exchanges a refresh token for new tokens', async () => {
    httpSpy.post.and.returnValue(of(mockLoginResponse));
    const service = createService();

    const result = await service.refreshToken('old-refresh-token');

    expect(httpSpy.post).toHaveBeenCalledWith('/api/auth/refresh', {
      refreshToken: 'old-refresh-token',
    });
    expect(result.accessToken).toBe('access-token-1');
    expect(service.token()).toBe('access-token-1');
    expect(localStorage.getItem('caregiver_access_token')).toBe('access-token-1');
    expect(localStorage.getItem('caregiver_refresh_token')).toBe('refresh-token-1');
  });

  it('clears state and navigates to login on logout', () => {
    const service = createService();
    service.handleLoginSuccess(mockLoginResponse);

    service.logout();

    expect(service.isAuthenticated()).toBe(false);
    expect(service.token()).toBeNull();
    expect(service.currentUser()).toBeNull();
    expect(localStorage.getItem('caregiver_access_token')).toBeNull();
    expect(localStorage.getItem('caregiver_refresh_token')).toBeNull();
    expect(localStorage.getItem('caregiver_user')).toBeNull();
    expect(alertSpy.disconnect).toHaveBeenCalled();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);
  });
});
