/**
 * apps/web/src/app/services/patient-favorites.service.ts
 *
 * PatientFavoritesService — tracks recently viewed and pinned patients.
 *
 * Uses localStorage for persistence across sessions. The favorites bar
 * in the app shell reads from this service to show quick-access chips.
 */
import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'caregiver_favorites';
const RECENT_STORAGE_KEY = 'caregiver_recent_patients';

export interface PatientFavorite {
  patientId: string;
  patientName?: string;
  pinnedAt: string;
}

@Injectable({ providedIn: 'root' })
export class PatientFavoritesService {
  readonly favorites = signal<PatientFavorite[]>([]);
  readonly recentPatients = signal<PatientFavorite[]>([]);

  constructor() {
    // Hydrate both lists from localStorage so pinned + recently-viewed
    // patients survive full page reloads and new browser sessions.
    this.loadFavorites();
    this.loadRecentPatients();
  }

  /** Add or update a patient in the favorites list. */
  addFavorite(patientId: string, patientName?: string): void {
    this.favorites.update((prev) => {
      const existing = prev.findIndex((f) => f.patientId === patientId);
      const entry: PatientFavorite = { patientId, patientName, pinnedAt: new Date().toISOString() };

      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = entry;
        return updated;
      }

      // Max 10 favorites
      return [...prev, entry].slice(0, 10);
    });

    this.saveFavorites();
  }

  /** Remove a patient from favorites. */
  removeFavorite(patientId: string): void {
    this.favorites.update((prev) => prev.filter((f) => f.patientId !== patientId));
    this.saveFavorites();
  }

  /** Check if a patient is favorited. */
  isFavorite(patientId: string): boolean {
    return this.favorites().some((f) => f.patientId === patientId);
  }

  /** Toggle favorite status. */
  toggleFavorite(patientId: string, patientName?: string): void {
    if (this.isFavorite(patientId)) {
      this.removeFavorite(patientId);
    } else {
      this.addFavorite(patientId, patientName);
    }
  }

  /**
   * Track a recently viewed patient (most recent first, max 20).
   *
   * Unlike pinned favorites (which the user removes explicitly), the
   * recents list is purely a convenience queue — it is persisted to
   * localStorage so the user's context survives reloads, but it is
   * expected to churn as new patients are opened.
   */
  trackRecent(patientId: string, patientName?: string): void {
    this.recentPatients.update((prev) => {
      const filtered = prev.filter((f) => f.patientId !== patientId);
      const entry: PatientFavorite = { patientId, patientName, pinnedAt: new Date().toISOString() };
      return [entry, ...filtered].slice(0, 20);
    });
    this.saveRecentPatients();
  }

  /** Hydrate pinned favorites from localStorage (best-effort, ignores corrupt data). */
  private loadFavorites(): void {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        this.favorites.set(JSON.parse(saved) as PatientFavorite[]);
      }
    } catch {
      // Ignore corrupt data
    }
  }

  /** Persist pinned favorites to localStorage. */
  private saveFavorites(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.favorites()));
  }

  /** Hydrate recently-viewed patients from localStorage (best-effort). */
  private loadRecentPatients(): void {
    try {
      const saved = localStorage.getItem(RECENT_STORAGE_KEY);
      if (saved) {
        this.recentPatients.set(JSON.parse(saved) as PatientFavorite[]);
      }
    } catch {
      // Ignore corrupt data
    }
  }

  /** Persist recently-viewed patients to localStorage. */
  private saveRecentPatients(): void {
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(this.recentPatients()));
  }
}
