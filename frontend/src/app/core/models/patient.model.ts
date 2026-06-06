import { Role } from './role.model';

export type PatientStatus = 'active' | 'discharged' | 'on-hold' | 'deceased';

export interface Patient {
  id: string;
  mrn: string;
  name: string;
  dob: string;
  age: number;
  sex: 'M' | 'F' | 'X';
  photo?: string;
  address: string;
  primaryDx: string[];          // ICD-10 codes + labels
  allergies: string[];
  codeStatus: 'Full' | 'DNR' | 'DNI' | 'DNR/DNI' | 'Comfort';
  careLevel: 'independent' | 'assisted' | 'skilled' | 'hospice';
  status: PatientStatus;
  admitDate: string;
  payer: string;
  careTeam: { userId: string; role: Role; lead?: boolean }[];
  emergencyContact: { name: string; relation: string; phone: string };
  riskFlags: ('fall' | 'aspiration' | 'wander' | 'skin' | 'sepsis' | 'polypharm')[];
  familyUserIds: string[];
  notes?: string;
}
