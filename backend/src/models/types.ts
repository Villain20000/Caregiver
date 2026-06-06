export enum Role {
  PATIENT = 'patient',
  FAMILY = 'family',
  NURSE = 'nurse',
  THERAPIST = 'therapist',
  DOCTOR = 'doctor',
  SOCIAL_WORKER = 'social',
  DISPATCHER = 'dispatcher',
  NUTRITIONIST = 'nutritionist',
  ADMIN = 'admin',
  BILLING = 'billing',
}

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
  primaryDx: string[];
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

export type VitalsFlag = 'normal' | 'watch' | 'critical';

export interface VitalsReading {
  id: string;
  patientId: string;
  timestamp: string;
  hr: number;
  systolic: number;
  diastolic: number;
  glucose: number;
  spo2: number;
  temp: number;
  flag: VitalsFlag;
  note?: string;
  recordedBy: string;
}

export interface Medication {
  id: string;
  name: string;
  dose: string;
  route: string;
  schedule: string;
  riskLevel: 'low' | 'moderate' | 'high' | 'controlled';
  prescribedBy: string;
  doubleVerify: boolean;
  category: 'cardiac' | 'endocrine' | 'analgesic' | 'psych' | 'supplement' | 'other';
  refillsRemaining: number;
  patientId: string;
  lastGiven?: string;
  lastGivenBy?: string;
  times: string[];
}

export interface MedAdministration {
  id: string;
  medicationId: string;
  patientId: string;
  givenAt: string;
  givenBy: string;
  verifiedBy?: string;
}

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
  start: string;
  end: string;
  geo?: GeoPoint;
  status: 'scheduled' | 'in-progress' | 'completed' | 'missed';
  visitType: 'routine' | 'adl' | 'wound' | 'therapy' | 'assessment' | 'meal';
  onCall: boolean;
  notes?: string;
}

export interface ChannelMember {
  userId: string;
  role: 'owner' | 'member';
  lastRead: string;
}

export interface Channel {
  id: string;
  name: string;
  kind: 'care-team' | 'clinical' | 'ops' | 'family' | 'direct';
  unread: number;
  pinned: boolean;
  encrypted: boolean;
  topic?: string;
  members: ChannelMember[];
  lastMessage?: Message;
}

export interface MessageReaction {
  emoji: string;
  userIds: string[];
}

export interface Message {
  id: string;
  channelId: string;
  authorId: string;
  text: string;
  timestamp: string;
  reactions?: MessageReaction[];
}

export interface LineItem {
  code: string;
  description: string;
  units: number;
  rate: number;
}

export interface Invoice {
  id: string;
  number: string;
  patientId: string;
  payer: string;
  issuedAt: string;
  dueAt: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  items: LineItem[];
  subtotal: number;
  tax: number;
  total: number;
}

export interface Claim {
  id: string;
  invoiceId: string;
  cpt: string;
  submittedAt?: string;
  status: 'queued' | 'submitted' | 'accepted' | 'paid' | 'denied' | 'appealed';
  payer: string;
  amount: number;
  denialReason?: string;
  appealDeadline?: string;
}

export interface Timesheet {
  id: string;
  userId: string;
  shiftId: string;
  clockIn: string;
  clockOut?: string;
  hours: number;
  status: 'open' | 'submitted' | 'approved' | 'rejected' | 'exported';
  notes?: string;
  approverId?: string;
}

export interface KanbanTask {
  id: string;
  title: string;
  status: 'todo' | 'doing' | 'done';
  assignee: string;
  patientId?: string;
  due?: string;
  priority: 'low' | 'med' | 'high' | 'urgent';
  tags: string[];
  createdBy: string;
  createdAt: string;
  estimateMin: number;
}

export interface WoundAssessment {
  id: string;
  patientId: string;
  location: string;
  stage: 'I' | 'II' | 'III' | 'IV' | 'Unstageable' | 'DTI';
  lengthCm: number;
  widthCm: number;
  depthCm: number;
  exudate: 'none' | 'scant' | 'minimal' | 'moderate' | 'copious' | 'serous' | 'serosanguineous' | 'purulent';
  odor: 'none' | 'mild' | 'strong' | 'foul';
  periWound: string;
  pain: number;
  notes?: string;
  photos: string[];
  assessedAt: string;
  assessedBy: string;
  trend: 'improving' | 'stable' | 'worsening';
}

export interface Incident {
  id: string;
  patientId: string;
  kind: 'fall' | 'med-error' | 'elopement' | 'skin-event' | 'behavioral' | 'other';
  severity: 'low' | 'med' | 'high' | 'critical';
  status: 'open' | 'investigating' | 'mitigated' | 'closed';
  occurredAt: string;
  reportedBy: string;
  reportedAt: string;
  summary: string;
  witnesses: string[];
  correctiveActions: string[];
  closedAt?: string;
  closedBy?: string;
}

export type AuditAction = 'login' | 'logout' | 'view' | 'create' | 'update' | 'delete' | 'sign' | 'export' | 'role-switch';

export interface AuditEntry {
  id: string;
  ts: string;
  action: AuditAction;
  userId: string;
  userName: string;
  resource: string;
  meta?: Record<string, any>;
}

export interface InventoryItem {
  sku: string;
  name: string;
  category: 'PPE' | 'Wound' | 'Skin' | 'Med' | 'Equipment' | 'Hygiene' | 'Nutrition' | 'Other';
  onHand: number;
  par: number;
  reorderAt: number;
  expiresAt?: string;
  supplier: string;
  unitCost: number;
}

export interface FamilyUpdate {
  id: string;
  patientId: string;
  ts: string;
  author: string;
  mood: 'great' | 'okay' | 'low';
  note: string;
  photo?: string;
}

export interface User {
  id: string;
  name: string;
  role: Role;
  avatar: string;
  email: string;
  phone: string;
  licenseNo?: string;
  npi?: string;
  credentials?: string[];
  homeBase?: string;
  online?: boolean;
}

export interface DatabaseState {
  users: User[];
  patients: Patient[];
  vitals: VitalsReading[];
  medications: Medication[];
  medAdministrations: MedAdministration[];
  schedule: ShiftEvent[];
  geoPoints: GeoPoint[];
  channels: Channel[];
  messages: Message[];
  invoices: Invoice[];
  claims: Claim[];
  timesheets: Timesheet[];
  tasks: KanbanTask[];
  wounds: WoundAssessment[];
  incidents: Incident[];
  auditEntries: AuditEntry[];
  inventory: InventoryItem[];
  familyUpdates: FamilyUpdate[];
}
