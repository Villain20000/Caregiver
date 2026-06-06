import { Role } from './role.model';

export type ShiftStatus = 'scheduled' | 'in-progress' | 'completed' | 'missed' | 'cancelled';

export interface GeoPoint {
  lat: number;
  lng: number;
  label: string;
}

export interface ShiftEvent {
  id: string;
  role: Role;
  userId: string;
  patientId?: string;
  start: string;      // ISO
  end: string;        // ISO
  geo?: GeoPoint;
  status: ShiftStatus;
  visitType?: 'routine' | 'adl' | 'wound' | 'therapy' | 'assessment' | 'meal' | 'telehealth';
  notes?: string;
  conflictsWith?: string[]; // shift ids
  onCall?: boolean;
}

export interface ScheduleConflict {
  shiftA: ShiftEvent;
  shiftB: ShiftEvent;
  overlapMinutes: number;
}
