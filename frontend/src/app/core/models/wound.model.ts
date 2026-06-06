export type WoundStage = 'I' | 'II' | 'III' | 'IV' | 'unstageable';

export interface WoundPhoto {
  id: string;
  takenAt: string;
  takenBy: string;
  url: string;            // placeholder
  width: number;
  height: number;
}

export interface WoundAssessment {
  id: string;
  patientId: string;
  location: string;       // e.g. 'Sacrum', 'Left heel'
  stage: WoundStage;
  lengthCm: number;
  widthCm: number;
  depthCm: number;
  exudate: 'none' | 'serous' | 'sanguineous' | 'serosanguineous' | 'purulent';
  odor: 'none' | 'mild' | 'moderate' | 'strong';
  periWound: string;
  pain: number;           // 0-10
  notes: string;
  photos: WoundPhoto[];
  assessedAt: string;
  assessedBy: string;
  trend: 'improving' | 'stable' | 'worsening';
}
