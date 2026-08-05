/**
 * apps/web/src/app/app.component.spec.ts
 *
 * Unit tests for the app-shell favorites bar — the strip that consumes
 * PatientFavoritesService to show pinned patients as quick-access chips.
 *
 * PatientFavoritesService is used REAL (it has no injected dependencies), so
 * these tests exercise the true integration: favorites hydrated from
 * localStorage render as chips, pinning a patient through the service
 * surfaces a new chip, and the remove button unpins it. AuthService,
 * AlertService, and ThemeService are mocked with lightweight signals/spies;
 * provideRouter([]) satisfies RouterLink / RouterOutlet dependencies.
 */
import { TestBed } from '@angular/core/testing';
import { signal, type WritableSignal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';
import { AuthService } from './services/auth.service';
import { AlertService } from './services/alert.service';
import { ThemeService } from './services/theme.service';
import { PatientFavoritesService } from './services/patient-favorites.service';
import type { UserProfile } from '@caregiver/contracts';

const STORAGE_KEY = 'caregiver_favorites';

function makeUser(role: UserProfile['role']): UserProfile {
  return {
    id: `user-${role}`,
    email: `${role}@caregiver.test`,
    fullName: 'Dr. Test',
    role,
    isActive: true,
  };
}

describe('AppComponent favorites bar', () => {
  let currentUser: WritableSignal<UserProfile | null>;
  let authMock: { currentUser: WritableSignal<UserProfile | null>; logout: jasmine.Spy };
  let alertMock: { alerts: WritableSignal<never[]>; acknowledge: jasmine.Spy; clear: jasmine.Spy };
  let themeMock: { toggle: jasmine.Spy; isDark: () => boolean };

  beforeEach(() => {
    localStorage.clear();
    currentUser = signal<UserProfile | null>(makeUser('doctor'));
    authMock = { currentUser, logout: jasmine.createSpy('logout') };
    alertMock = {
      alerts: signal([]),
      acknowledge: jasmine.createSpy('acknowledge'),
      clear: jasmine.createSpy('clear'),
    };
    themeMock = { toggle: jasmine.createSpy('toggle'), isDark: () => false };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authMock },
        { provide: AlertService, useValue: alertMock },
        { provide: ThemeService, useValue: themeMock },
      ],
    });
  });

  function createShell(user: UserProfile | null) {
    currentUser.set(user);
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  }

  /** Seed pinned favorites into localStorage before the shell hydrates. */
  function seedFavorites(entries: Array<{ patientId: string; patientName?: string }>) {
    const pinned = entries.map((e) => ({
      patientId: e.patientId,
      patientName: e.patientName,
      pinnedAt: '2026-01-01T00:00:00.000Z',
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pinned));
  }

  // ── Chip rendering ──────────────────────────────────────────

  it('renders a chip for each favorited patient', () => {
    seedFavorites([
      { patientId: 'pat-1', patientName: 'Jane Doe' },
      { patientId: 'pat-2', patientName: 'John Smith' },
    ]);
    const { fixture } = createShell(makeUser('doctor'));

    const chips = fixture.nativeElement.querySelectorAll('.fav-chip');
    expect(chips.length).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('Jane Doe');
    expect(fixture.nativeElement.textContent).toContain('John Smith');
  });

  it('falls back to the patient id when no name is stored', () => {
    seedFavorites([{ patientId: 'pat-42' }]);
    const { fixture } = createShell(makeUser('doctor'));

    expect(fixture.nativeElement.querySelector('.fav-name')?.textContent).toContain('pat-42');
  });

  it('shows the empty-state hint when there are no favorites', () => {
    const { fixture } = createShell(makeUser('doctor'));

    expect(fixture.nativeElement.textContent).toContain('Pin patients to access them quickly');
    expect(fixture.nativeElement.querySelectorAll('.fav-chip').length).toBe(0);
  });

  // ── Unpin (remove button) ───────────────────────────────────

  it('unpins a patient when its remove button is clicked', () => {
    seedFavorites([{ patientId: 'pat-1', patientName: 'Jane Doe' }]);
    const { fixture } = createShell(makeUser('doctor'));

    const removeBtn = fixture.nativeElement.querySelector('.fav-remove') as HTMLElement;
    removeBtn.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.fav-chip').length).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('Pin patients to access them quickly');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')).toEqual([]);
  });

  it('labels remove buttons accessibly', () => {
    seedFavorites([{ patientId: 'pat-1', patientName: 'Jane Doe' }]);
    const { fixture } = createShell(makeUser('doctor'));

    expect(fixture.nativeElement.querySelector('.fav-remove')?.getAttribute('aria-label')).toBe(
      'Remove Jane Doe from favorites',
    );
  });

  // ── Pin (service-driven) ────────────────────────────────────

  it('surfaces a newly pinned patient as a chip', () => {
    const { fixture } = createShell(makeUser('doctor'));
    const favoritesService = TestBed.inject(PatientFavoritesService);

    favoritesService.toggleFavorite('pat-9', 'Ada Lovelace');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Ada Lovelace');
    expect(fixture.nativeElement.querySelectorAll('.fav-chip').length).toBe(1);
  });

  it('calls openPatient with the patient id when a chip is clicked', () => {
    seedFavorites([{ patientId: 'pat-1', patientName: 'Jane Doe' }]);
    const { fixture, component } = createShell(makeUser('doctor'));
    const openSpy = spyOn(component, 'openPatient');

    (fixture.nativeElement.querySelector('.fav-chip') as HTMLElement).click();

    expect(openSpy).toHaveBeenCalledWith('pat-1');
  });

  // ── Auth gating ─────────────────────────────────────────────

  it('hides the favorites bar when logged out', () => {
    const { fixture } = createShell(null);

    expect(fixture.nativeElement.querySelector('.favorites-bar')).toBeNull();
  });
});
