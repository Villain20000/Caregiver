/**
 * apps/web/src/app/services/patient-favorites.service.spec.ts
 *
 * Unit tests for PatientFavoritesService — pinned favorites and recently
 * viewed patients persisted to localStorage.
 *
 * The service has no injected dependencies, so every test constructs a
 * fresh instance directly (`new PatientFavoritesService()`) — this also
 * re-runs the constructor's hydration reads against the current
 * localStorage state (the same pattern ThemeService's restore test uses).
 * localStorage is cleared before each test.
 */
import { PatientFavoritesService } from './patient-favorites.service';

describe('PatientFavoritesService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts with empty favorites and recents', () => {
    const service = new PatientFavoritesService();

    expect(service.favorites()).toEqual([]);
    expect(service.recentPatients()).toEqual([]);
  });

  it('adds a favorite and persists it to localStorage', () => {
    const service = new PatientFavoritesService();

    service.addFavorite('pat-1', 'Jane Doe');

    expect(service.favorites()).toEqual([
      { patientId: 'pat-1', patientName: 'Jane Doe', pinnedAt: jasmine.any(String) },
    ]);
    expect(service.isFavorite('pat-1')).toBe(true);
    expect(JSON.parse(localStorage.getItem('caregiver_favorites') ?? '[]')).toEqual([
      { patientId: 'pat-1', patientName: 'Jane Doe', pinnedAt: jasmine.any(String) },
    ]);
  });

  it('updates an existing favorite in place instead of duplicating', () => {
    const service = new PatientFavoritesService();

    service.addFavorite('pat-1', 'Jane');
    service.addFavorite('pat-1', 'Jane Doe');

    expect(service.favorites().length).toBe(1);
    expect(service.favorites()[0]?.patientName).toBe('Jane Doe');
    expect(service.favorites()[0]?.pinnedAt).toEqual(jasmine.any(String));
  });

  it('caps pinned favorites at 10 (oldest pushed out)', () => {
    const service = new PatientFavoritesService();

    for (let i = 0; i < 12; i++) service.addFavorite(`pat-${i}`);

    expect(service.favorites().length).toBe(10);
    expect(service.favorites().map((f) => f.patientId)).toEqual([
      'pat-0',
      'pat-1',
      'pat-2',
      'pat-3',
      'pat-4',
      'pat-5',
      'pat-6',
      'pat-7',
      'pat-8',
      'pat-9',
    ]);
  });

  it('removes a favorite and persists the removal', () => {
    const service = new PatientFavoritesService();
    service.addFavorite('pat-1', 'Jane Doe');

    service.removeFavorite('pat-1');

    expect(service.favorites()).toEqual([]);
    expect(service.isFavorite('pat-1')).toBe(false);
    expect(localStorage.getItem('caregiver_favorites')).toBe('[]');
  });

  it('toggles a favorite on, then off', () => {
    const service = new PatientFavoritesService();

    service.toggleFavorite('pat-1', 'Jane Doe');
    expect(service.isFavorite('pat-1')).toBe(true);

    service.toggleFavorite('pat-1');
    expect(service.isFavorite('pat-1')).toBe(false);
  });

  it('tracks recent patients most-recent-first and dedupes', () => {
    const service = new PatientFavoritesService();

    service.trackRecent('pat-a', 'A');
    service.trackRecent('pat-b', 'B');
    expect(service.recentPatients().map((p) => p.patientId)).toEqual(['pat-b', 'pat-a']);

    // Re-opening 'pat-a' moves it back to the front without duplicating.
    service.trackRecent('pat-a', 'A');
    expect(service.recentPatients().map((p) => p.patientId)).toEqual(['pat-a', 'pat-b']);
    expect(service.recentPatients().length).toBe(2);
  });

  it('persists recents and caps them at 20', () => {
    const service = new PatientFavoritesService();

    for (let i = 0; i < 25; i++) service.trackRecent(`pat-${i}`);

    expect(service.recentPatients().length).toBe(20);
    expect(service.recentPatients()[0]?.patientId).toBe('pat-24');
    const saved = JSON.parse(localStorage.getItem('caregiver_recent_patients') ?? '[]');
    expect(saved.length).toBe(20);
  });

  it('hydrates favorites and recents from localStorage on construction', () => {
    const pinned = [
      { patientId: 'pat-9', patientName: 'Hydrated', pinnedAt: '2026-01-01T00:00:00.000Z' },
    ];
    const recent = [
      { patientId: 'pat-2', patientName: 'Recent', pinnedAt: '2026-01-02T00:00:00.000Z' },
    ];
    localStorage.setItem('caregiver_favorites', JSON.stringify(pinned));
    localStorage.setItem('caregiver_recent_patients', JSON.stringify(recent));

    const service = new PatientFavoritesService();

    expect(service.favorites()).toEqual(pinned);
    expect(service.recentPatients()).toEqual(recent);
  });

  it('ignores corrupt localStorage JSON and stays empty', () => {
    localStorage.setItem('caregiver_favorites', '{not-valid-json');
    localStorage.setItem('caregiver_recent_patients', '[broken');

    // Construction must not throw on corrupt data, and both lists stay empty.
    const service = new PatientFavoritesService();

    expect(service.favorites()).toEqual([]);
    expect(service.recentPatients()).toEqual([]);
  });
});
