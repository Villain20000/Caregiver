export type VitalsFlag = 'normal' | 'watch' | 'critical';

export interface VitalsReading {
  id: string;
  patientId: string;
  timestamp: string;   // ISO
  hr: number;          // bpm
  systolic: number;    // mmHg
  diastolic: number;   // mmHg
  glucose: number;     // mg/dL
  spo2: number;        // %
  temp: number;        // °F
  flag: VitalsFlag;
  note?: string;
  recordedBy: string;  // userId
}

export interface VitalsStats {
  latest: VitalsReading | null;
  avgHr: number;
  avgSystolic: number;
  avgDiastolic: number;
  avgGlucose: number;
  avgSpo2: number;
  avgTemp: number;
  criticalCount: number;
  watchCount: number;
}
