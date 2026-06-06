import { Injectable, computed, signal } from '@angular/core';
import { WoundAssessment } from '../models/wound.model';
import { MockDataService } from './mock-data.service';

@Injectable({ providedIn: 'root' })
export class WoundService {
  private readonly _wounds = signal<WoundAssessment[]>([]);
  readonly wounds = this._wounds.asReadonly();

  readonly active = computed<WoundAssessment[]>(() => this._wounds().filter((w) => w.trend !== 'worsening'));
  readonly worsening = computed<WoundAssessment[]>(() => this._wounds().filter((w) => w.trend === 'worsening'));

  constructor(private readonly mock: MockDataService) {
    this._wounds.set(this.mock.wounds());
  }

  byPatient(patientId: string): WoundAssessment[] {
    return this._wounds().filter((w) => w.patientId === patientId);
  }
}
