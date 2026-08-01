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
    this.loadFavorites();
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

  /** Track a recently viewed patient. */
  trackRecent(patientId: string, patientName?: string): void {
    this.recentPatients.update((prev) => {
      const filtered = prev.filter((f) => f.patientId !== patientId);
      const entry: PatientFavorite = { patientId, patientName, pinnedAt: new Date().toISOString() };
      return [entry, ...filtered].slice(0, 20);
    });
  }

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

  private saveFavorites(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.favorites()));
  }
}
