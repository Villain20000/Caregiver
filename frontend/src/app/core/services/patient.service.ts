import { Injectable, computed, signal } from '@angular/core';
import { Patient } from '../models/patient.model';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from './api.config';

@Injectable({ providedIn: 'root' })
export class PatientService {
  private readonly _patients = signal<Patient[]>([]);
  readonly patients = this._patients.asReadonly();

  readonly active = computed<Patient[]>(() => this._patients().filter((p) => p.status === 'active'));
  readonly count = computed<number>(() => this._patients().length);

  constructor(private readonly http: HttpClient) {
    this.load();
  }

  load(): void {
    this.http.get<Patient[]>(`${API_BASE_URL}/patients`).subscribe({
      next: (data) => this._patients.set(data),
      error: (err) => console.error('Failed to load patients', err),
    });
  }

  byId(id: string): Patient | undefined {
    return this._patients().find((p) => p.id === id);
  }
}
