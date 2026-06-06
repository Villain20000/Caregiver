import { Injectable } from '@angular/core';
import { AuditAction, AuditEntry } from '../models/audit.model';
import { Channel, Message } from '../models/chat.model';
import { Claim, Invoice, LineItem, Timesheet } from '../models/billing.model';
import { Incident } from '../models/incident.model';
import { KanbanTask } from '../models/task.model';
import { Medication, MedAdministration } from '../models/medication.model';
import { Patient } from '../models/patient.model';
import { Role } from '../models/role.model';
import { GeoPoint, ShiftEvent } from '../models/schedule.model';
import { VitalsReading } from '../models/vitals.model';
import { WoundAssessment } from '../models/wound.model';
import { InventoryItem } from '../models/inventory.model';
import { MOCK_USERS } from '../models/user.model';

const SEED_NOW = Date.now();
const minutesAgo = (m: number) => new Date(SEED_NOW - m * 60_000).toISOString();
const hoursAgo = (h: number) => minutesAgo(h * 60);
const daysAgo = (d: number) => hoursAgo(d * 24);

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

@Injectable({ providedIn: 'root' })
export class MockDataService {
  // -----------------------------------------------------------------------
  // Patients
  // -----------------------------------------------------------------------
  patients(): Patient[] {
    const dx = (i: number) => pick<Patient['primaryDx']>(
      [
        ['I50.9 (CHF)', 'E11.9 (T2DM)'],
        ['I63.9 (CVA)', 'M81.0 (Osteoporosis)'],
        ['C34.9 (Lung CA)', 'R53.81 (Cachexia)'],
        ['N18.4 (CKD-4)'],
        ['I10 (HTN)'],
        ['F03.90 (Dementia)', 'R41.840'],
        ['J44.9 (COPD)'],
        ['M54.5 (LBP)'],
      ],
      i,
    );
    const allergy = (i: number) => pick<Patient['allergies']>(
      [['Penicillin'], ['Sulfa'], ['Latex'], ['Iodine'], ['None'], ['Aspirin']],
      i,
    );
    const hood = (i: number) =>
      pick(['Mission District', 'Sunset', 'Castro', 'Bernal Heights', 'Noe Valley', 'Richmond', 'Bayview', 'Excelsior'], i);

    const seeds: Array<Omit<Patient, 'mrn' | 'dob' | 'address' | 'emergencyContact' | 'riskFlags'> & { id: string }> = [
      { id: 'pat-1', name: 'Walter Mendes',   age: 71, sex: 'M', status: 'active',     careLevel: 'skilled',     primaryDx: dx(0), allergies: allergy(0), codeStatus: 'Full', admitDate: daysAgo(34), payer: 'Medicare A', careTeam: [{ userId: 'u-doc1', role: Role.DOCTOR, lead: true }, { userId: 'u-nurse1', role: Role.NURSE }, { userId: 'u-ther1', role: Role.THERAPIST }, { userId: 'u-soc1', role: Role.SOCIAL_WORKER }, { userId: 'u-fam1', role: Role.FAMILY }], familyUserIds: ['u-fam1'] },
      { id: 'pat-2', name: 'Eleanor Whitlock', age: 82, sex: 'F', status: 'active',    careLevel: 'assisted',    primaryDx: dx(1), allergies: allergy(1), codeStatus: 'DNR', admitDate: daysAgo(56), payer: 'Medicare B', careTeam: [{ userId: 'u-doc2', role: Role.DOCTOR, lead: true }, { userId: 'u-nurse1', role: Role.NURSE }, { userId: 'u-soc1', role: Role.SOCIAL_WORKER }], familyUserIds: ['u-fam1'] },
      { id: 'pat-3', name: 'Reggie Okafor',   age: 67, sex: 'M', status: 'active',     careLevel: 'hospice',     primaryDx: dx(2), allergies: allergy(2), codeStatus: 'Comfort', admitDate: daysAgo(120), payer: 'Medicare A', careTeam: [{ userId: 'u-doc1', role: Role.DOCTOR, lead: true }, { userId: 'u-nurse2', role: Role.NURSE }, { userId: 'u-soc1', role: Role.SOCIAL_WORKER }], familyUserIds: ['u-fam1'] },
      { id: 'pat-4', name: 'Hana Lindqvist',  age: 58, sex: 'F', status: 'active',     careLevel: 'skilled',     primaryDx: dx(3), allergies: allergy(3), codeStatus: 'Full', admitDate: daysAgo(89), payer: 'BCBS', careTeam: [{ userId: 'u-doc2', role: Role.DOCTOR, lead: true }, { userId: 'u-nurse1', role: Role.NURSE }], familyUserIds: ['u-fam1'] },
      { id: 'pat-5', name: 'Idris Mahmoud',   age: 74, sex: 'M', status: 'active',     careLevel: 'independent', primaryDx: dx(4), allergies: allergy(4), codeStatus: 'Full', admitDate: daysAgo(15), payer: 'Self-pay', careTeam: [{ userId: 'u-doc1', role: Role.DOCTOR, lead: true }, { userId: 'u-nurse1', role: Role.NURSE }], familyUserIds: ['u-fam1'] },
      { id: 'pat-6', name: 'Yolanda Chen',    age: 79, sex: 'F', status: 'on-hold',    careLevel: 'assisted',    primaryDx: dx(5), allergies: allergy(5), codeStatus: 'DNR/DNI', admitDate: daysAgo(220), payer: 'Aetna', careTeam: [{ userId: 'u-doc2', role: Role.DOCTOR, lead: true }, { userId: 'u-soc1', role: Role.SOCIAL_WORKER }], familyUserIds: ['u-fam1'] },
      { id: 'pat-7', name: 'Marcus Bell',     age: 63, sex: 'M', status: 'active',     careLevel: 'skilled',     primaryDx: dx(6), allergies: allergy(2), codeStatus: 'Full', admitDate: daysAgo(48), payer: 'BCBS', careTeam: [{ userId: 'u-doc1', role: Role.DOCTOR, lead: true }, { userId: 'u-nurse1', role: Role.NURSE }, { userId: 'u-ther1', role: Role.THERAPIST }], familyUserIds: ['u-fam1'] },
      { id: 'pat-8', name: 'Aiyana Crow',     age: 55, sex: 'F', status: 'discharged', careLevel: 'independent', primaryDx: dx(7), allergies: allergy(4), codeStatus: 'Full', admitDate: daysAgo(360), payer: 'Aetna', careTeam: [{ userId: 'u-doc2', role: Role.DOCTOR, lead: true }], familyUserIds: ['u-fam1'] },
    ];
    return seeds.map((s, i) => ({
      ...s,
      mrn: 'MRN-' + s.id.replace('pat-', '').padStart(5, '0'),
      dob: `${19}${70 + (i % 20)}-0${(i % 9) + 1}-1${(i % 8) + 1}`,
      address: `${100 + i} ${hood(i)} Ave, San Francisco, CA`,
      riskFlags: pick<Patient['riskFlags']>(
        [['fall'], ['fall', 'polypharm'], ['wander'], ['skin'], ['aspiration'], []],
        i,
      ),
      emergencyContact: {
        name: pick(['Sofia Mendes', 'David Whitlock', 'Adaeze Okafor', 'Eva Lindqvist', 'Jamal Mahmoud', 'Lin Chen', 'Troy Bell', 'Sky Crow'], i),
        relation: 'Daughter',
        phone: '+1 415 555 0' + (200 + i),
      },
    }));
  }
  // -----------------------------------------------------------------------
  // Vitals
  // -----------------------------------------------------------------------
  vitals(): VitalsReading[] {
    const out: VitalsReading[] = [];
    for (let i = 0; i < 30; i++) {
      const patientId = pick(['pat-1', 'pat-2', 'pat-4', 'pat-7'], i);
      const hr = 60 + Math.round(Math.sin(i / 3) * 12 + Math.random() * 8);
      const sys = 120 + Math.round(Math.cos(i / 4) * 14 + Math.random() * 6);
      const dia = 76 + Math.round(Math.sin(i / 5) * 8 + Math.random() * 4);
      const glu = 100 + Math.round(Math.random() * 70);
      const spo2 = 95 + Math.round(Math.random() * 4);
      const temp = 97.6 + Math.random() * 1.4;
      const critical = hr > 110 || hr < 50 || sys > 160 || sys < 90 || spo2 < 92 || temp > 100.4;
      const watch = !critical && (hr > 95 || sys > 145 || spo2 < 95 || glu > 180);
      out.push({
        id: `vtl-${i + 1}`,
        patientId,
        timestamp: minutesAgo(i * 27 + 5),
        hr, systolic: sys, diastolic: dia, glucose: glu, spo2, temp: Math.round(temp * 10) / 10,
        flag: critical ? 'critical' : watch ? 'watch' : 'normal',
        note: i % 6 === 0 ? 'Post-medication check' : undefined,
        recordedBy: pick(['u-nurse1', 'u-nurse2', 'u-doc1'], i),
      });
    }
    return out;
  }

  // -----------------------------------------------------------------------
  // Medications
  // -----------------------------------------------------------------------
  medications(): Medication[] {
    const seeds: Array<Omit<Medication, 'id' | 'times'>> = [
      { name: 'Lisinopril', dose: '10 mg', route: 'PO', schedule: '08:00', riskLevel: 'moderate', prescribedBy: 'u-doc1', doubleVerify: false, category: 'cardiac', refillsRemaining: 3, patientId: 'pat-1', lastGiven: hoursAgo(6), lastGivenBy: 'u-nurse1' },
      { name: 'Metformin', dose: '500 mg', route: 'PO', schedule: '08:00, 20:00', riskLevel: 'low', prescribedBy: 'u-doc1', doubleVerify: false, category: 'endocrine', refillsRemaining: 5, patientId: 'pat-1', lastGiven: hoursAgo(2), lastGivenBy: 'u-nurse1' },
      { name: 'Furosemide', dose: '20 mg', route: 'PO', schedule: '08:00', riskLevel: 'moderate', prescribedBy: 'u-doc1', doubleVerify: false, category: 'cardiac', refillsRemaining: 2, patientId: 'pat-1', lastGiven: hoursAgo(8), lastGivenBy: 'u-nurse1' },
      { name: 'Insulin Glargine', dose: '18 units', route: 'SC', schedule: '21:00', riskLevel: 'high', prescribedBy: 'u-doc1', doubleVerify: true, category: 'endocrine', refillsRemaining: 1, patientId: 'pat-1', lastGiven: hoursAgo(11), lastGivenBy: 'u-nurse2' },
      { name: 'Apixaban', dose: '5 mg', route: 'PO', schedule: '08:00, 20:00', riskLevel: 'high', prescribedBy: 'u-doc2', doubleVerify: true, category: 'cardiac', refillsRemaining: 0, patientId: 'pat-2' },
      { name: 'Sertraline', dose: '50 mg', route: 'PO', schedule: '08:00', riskLevel: 'moderate', prescribedBy: 'u-doc2', doubleVerify: false, category: 'psych', refillsRemaining: 4, patientId: 'pat-2', lastGiven: hoursAgo(7), lastGivenBy: 'u-nurse1' },
      { name: 'Acetaminophen', dose: '650 mg', route: 'PO', schedule: 'Q6H PRN', riskLevel: 'low', prescribedBy: 'u-doc1', doubleVerify: false, category: 'analgesic', refillsRemaining: 6, patientId: 'pat-3', lastGiven: hoursAgo(3), lastGivenBy: 'u-nurse2' },
      { name: 'Morphine Sulfate', dose: '5 mg', route: 'PO', schedule: 'Q4H PRN', riskLevel: 'controlled', prescribedBy: 'u-doc1', doubleVerify: true, category: 'analgesic', refillsRemaining: 0, patientId: 'pat-3', lastGiven: hoursAgo(1), lastGivenBy: 'u-nurse1' },
      { name: 'Sevelamer', dose: '800 mg', route: 'PO', schedule: '08:00, 12:00, 18:00', riskLevel: 'moderate', prescribedBy: 'u-doc1', doubleVerify: false, category: 'other', refillsRemaining: 2, patientId: 'pat-4', lastGiven: hoursAgo(5), lastGivenBy: 'u-nurse1' },
      { name: 'Epoetin Alfa', dose: '4000 units', route: 'SC', schedule: 'M,W,F 09:00', riskLevel: 'high', prescribedBy: 'u-doc1', doubleVerify: true, category: 'other', refillsRemaining: 1, patientId: 'pat-4' },
      { name: 'Tiotropium', dose: '18 mcg', route: 'INH', schedule: '08:00', riskLevel: 'moderate', prescribedBy: 'u-doc1', doubleVerify: false, category: 'other', refillsRemaining: 3, patientId: 'pat-7', lastGiven: hoursAgo(9), lastGivenBy: 'u-nurse1' },
      { name: 'Vitamin D3', dose: '2000 IU', route: 'PO', schedule: '08:00', riskLevel: 'low', prescribedBy: 'u-doc1', doubleVerify: false, category: 'supplement', refillsRemaining: 8, patientId: 'pat-5', lastGiven: hoursAgo(10), lastGivenBy: 'u-nurse1' },
    ];
    return seeds.map((s, i) => {
      const times = s.schedule.split(',').map((t) => {
        const trimmed = t.trim();
        const hm = trimmed.match(/^(\d{1,2}):(\d{2})/);
        const d = new Date();
        if (hm) {
          d.setHours(parseInt(hm[1], 10), parseInt(hm[2], 10), 0, 0);
        } else {
          d.setHours(8, 0, 0, 0);
        }
        if (d.getTime() < Date.now() - 60 * 60_000) d.setDate(d.getDate() + 1);
        return d.toISOString();
      });
      return {
        ...s,
        id: `med-${i + 1}`,
        times,
      };
    });
  }

  medAdministrations(): MedAdministration[] {
    return Array.from({ length: 20 }).map((_, i) => ({
      id: `adm-${i + 1}`,
      medicationId: `med-${(i % 12) + 1}`,
      patientId: pick(['pat-1', 'pat-2', 'pat-3', 'pat-4', 'pat-7'], i),
      givenAt: hoursAgo(i * 4 + 2),
      givenBy: 'u-nurse1',
      verifiedBy: i % 4 === 0 ? 'u-nurse2' : undefined,
    }));
  }
  // -----------------------------------------------------------------------
  // Schedule
  // -----------------------------------------------------------------------
  schedule(): ShiftEvent[] {
    const out: ShiftEvent[] = [];
    for (let i = 0; i < 20; i++) {
      const role = pick([Role.NURSE, Role.NURSE, Role.THERAPIST, Role.DISPATCHER, Role.SOCIAL_WORKER, Role.NUTRITIONIST], i);
      const user = MOCK_USERS.find((u) => u.role === role) ?? MOCK_USERS[1];
      const start = new Date();
      start.setHours(7 + (i % 12), 0, 0, 0);
      if (i < 8) start.setDate(start.getDate() - 1);
      const end = new Date(start);
      end.setHours(start.getHours() + (role === Role.THERAPIST ? 1 : role === Role.NUTRITIONIST ? 2 : 4));
      out.push({
        id: `sh-${i + 1}`,
        role,
        userId: user.id,
        patientId: i % 3 === 0 ? undefined : pick(['pat-1', 'pat-2', 'pat-4', 'pat-7'], i),
        start: start.toISOString(),
        end: end.toISOString(),
        geo: { lat: 37.77, lng: -122.42, label: pick(['Mission District', 'Sunset', 'Castro', 'Noe Valley', 'Bernal Heights'], i) },
        status: i < 6 ? 'completed' : i < 14 ? 'scheduled' : i < 18 ? 'in-progress' : 'missed',
        visitType: pick(['routine', 'adl', 'wound', 'therapy', 'assessment', 'meal'], i),
        onCall: i % 5 === 0,
        notes: i % 4 === 0 ? 'Bring translation card' : undefined,
      });
    }
    return out;
  }

  geoPoints(): GeoPoint[] {
    return [
      { lat: 37.7599, lng: -122.4148, label: 'Mission District' },
      { lat: 37.7551, lng: -122.4923, label: 'Sunset' },
      { lat: 37.7609, lng: -122.4350, label: 'Castro' },
      { lat: 37.7510, lng: -122.4337, label: 'Bernal Heights' },
      { lat: 37.7510, lng: -122.4480, label: 'Noe Valley' },
      { lat: 37.7747, lng: -122.4885, label: 'Outer Richmond' },
      { lat: 37.7274, lng: -122.4760, label: 'Excelsior' },
      { lat: 37.7298, lng: -122.3933, label: 'Bayview' },
    ];
  }

  // -----------------------------------------------------------------------
  // Chat
  // -----------------------------------------------------------------------
  channels(): Channel[] {
    return [
      this.mkChannel('ch-1', '#mission-control',   'care-team', true,  ['u-admin', 'u-nurse1', 'u-doc1', 'u-disp1', 'u-bill1']),
      this.mkChannel('ch-2', '#medication-pass',   'clinical',  true,  ['u-nurse1', 'u-nurse2', 'u-doc1', 'u-doc2']),
      this.mkChannel('ch-3', '#family-mendes',     'family',    true,  ['u-fam1', 'u-nurse1', 'u-soc1', 'u-doc1']),
      this.mkChannel('ch-4', '#on-call-night',     'ops',       true,  ['u-disp1', 'u-nurse1', 'u-nurse2', 'u-doc2']),
      this.mkChannel('ch-5', 'DM: Maya ↔ Dr. Park','direct',    false, ['u-nurse1', 'u-doc1']),
      this.mkChannel('ch-6', '#wound-care-rounds', 'clinical',  true,  ['u-nurse1', 'u-doc1', 'u-ther1']),
      this.mkChannel('ch-7', '#billing-queue',     'ops',       true,  ['u-bill1', 'u-admin']),
      this.mkChannel('ch-8', '#nutrition-circle',  'care-team', true,  ['u-nutr1', 'u-nurse1', 'u-soc1', 'u-fam1']),
      this.mkChannel('ch-9', '#therapy-team',      'care-team', true,  ['u-ther1', 'u-doc1', 'u-nurse1']),
      this.mkChannel('ch-10','#dispatch-floor',    'ops',       true,  ['u-disp1', 'u-admin', 'u-nurse1', 'u-nurse2']),
    ];
  }

  private mkChannel(id: string, name: string, kind: Channel['kind'], pinned: boolean, members: string[]): Channel {
    const list = members.map((userId) => ({ userId, role: 'member' as const, lastRead: minutesAgo(Math.floor(Math.random() * 120)) }));
    return { id, name, kind, members: list, unread: Math.floor(Math.random() * 6), pinned, encrypted: kind !== 'direct', topic: kind === 'care-team' ? 'Care team coordination' : undefined };
  }

  messages(): Message[] {
    const out: Message[] = [];
    const samples: Array<Omit<Message, 'id' | 'channelId' | 'timestamp' | 'authorId'> & { authorId: string; channelId: string }> = [
      { channelId: 'ch-1', authorId: 'u-admin',  text: 'Morning team. Quick standup at 08:15 in the war room.' },
      { channelId: 'ch-1', authorId: 'u-disp1',  text: 'Maya you are routed to pat-1 first today, Tomás is covering pat-2.' },
      { channelId: 'ch-1', authorId: 'u-nurse1', text: 'Copy. BP was elevated at last check, will re-take on arrival.' },
      { channelId: 'ch-1', authorId: 'u-doc1',   text: 'Appreciate the heads up. Increase Lisinopril to 20mg if SBP > 150 twice.' },
      { channelId: 'ch-2', authorId: 'u-nurse2', text: 'Insulin due at 21:00 for pat-1, can someone co-sign?' },
      { channelId: 'ch-2', authorId: 'u-nurse1', text: 'On it. Will be there at 20:50.' },
      { channelId: 'ch-3', authorId: 'u-fam1',   text: 'Dad seemed more alert today, thank you all ❤️' },
      { channelId: 'ch-3', authorId: 'u-soc1',   text: 'Wonderful to hear Sofia. We added a puzzle book to the rotation.' },
      { channelId: 'ch-3', authorId: 'u-nurse1', text: 'He walked 30ft with standby assist today.' },
      { channelId: 'ch-4', authorId: 'u-disp1',  text: 'Night shift pick-up: Tomás to pat-3, backup is Maya.' },
      { channelId: 'ch-5', authorId: 'u-doc1',   text: 'Can you recheck the INR for pat-4 tomorrow morning?' },
      { channelId: 'ch-5', authorId: 'u-nurse1', text: 'Yes, will pull labs at 07:00.' },
      { channelId: 'ch-6', authorId: 'u-doc1',   text: 'Sacral wound trending better, continue current dressing protocol.' },
      { channelId: 'ch-7', authorId: 'u-bill1',  text: 'Two BCBS claims need corrected modifier 25. Pushing by EOD.' },
      { channelId: 'ch-8', authorId: 'u-nutr1',  text: 'New renal-friendly menu goes live Monday for pat-4.' },
      { channelId: 'ch-9', authorId: 'u-ther1',  text: 'pat-7 cleared for 100ft ambulation w/ rollator.' },
      { channelId: 'ch-10',authorId: 'u-disp1',  text: 'Mileage log sync is failing on Tomás\'s tablet.' },
    ];
    samples.forEach((m, i) => {
      out.push({
        id: `msg-${i + 1}`,
        channelId: m.channelId,
        authorId: m.authorId,
        text: m.text,
        timestamp: minutesAgo(i * 11 + 3),
        reactions: i % 3 === 0 ? [{ emoji: '👍', userIds: ['u-admin', 'u-nurse2'] }] : undefined,
      });
    });
    return out;
  }
  // -----------------------------------------------------------------------
  // Billing
  // -----------------------------------------------------------------------
  invoices(): Invoice[] {
    const cptTable: Array<[string, string, number]> = [
      ['99306', 'Nursing facility comprehensive', 285],
      ['99213', 'Office visit, established', 110],
      ['97110', 'Therapeutic exercises, 15 min', 35],
      ['97530', 'Therapeutic activities, 15 min', 42],
      ['G0438', 'Annual wellness visit', 165],
      ['99490', 'Chronic care management', 62],
    ];
    const out: Invoice[] = [];
    for (let i = 0; i < 12; i++) {
      const items: LineItem[] = [];
      const n = 1 + (i % 3);
      let subtotal = 0;
      for (let k = 0; k < n; k++) {
        const c = cptTable[(i + k) % cptTable.length];
        const units = 1 + ((i + k) % 2);
        items.push({ code: c[0], description: c[1], units, rate: c[2] });
        subtotal += c[2] * units;
      }
      const tax = Math.round(subtotal * 0.015 * 100) / 100;
      const issued = new Date(SEED_NOW - (i * 6 + 3) * 86_400_000);
      const due = new Date(issued);
      due.setDate(due.getDate() + 30);
      out.push({
        id: `inv-${i + 1}`,
        number: 'INV-2025-' + String(i + 1).padStart(4, '0'),
        patientId: pick(['pat-1', 'pat-2', 'pat-3', 'pat-4', 'pat-5', 'pat-7'], i),
        payer: pick(['Medicare A', 'Medicare B', 'BCBS', 'Aetna', 'Self-pay'], i),
        issuedAt: issued.toISOString(),
        dueAt: due.toISOString(),
        status: pick<Invoice['status']>(['paid', 'sent', 'sent', 'overdue', 'draft', 'paid'], i),
        items,
        subtotal: Math.round(subtotal * 100) / 100,
        tax,
        total: Math.round((subtotal + tax) * 100) / 100,
      });
    }
    return out;
  }

  claims(): Claim[] {
    return Array.from({ length: 14 }).map((_, i) => ({
      id: `clm-${i + 1}`,
      invoiceId: `inv-${(i % 12) + 1}`,
      cpt: pick(['99306', '99213', '97110', '97530', 'G0438', '99490'], i),
      submittedAt: i % 4 === 0 ? undefined : daysAgo(2 + (i % 10)),
      status: pick<Claim['status']>(['queued', 'submitted', 'accepted', 'paid', 'denied', 'appealed'], i),
      payer: pick(['Medicare A', 'Medicare B', 'BCBS', 'Aetna'], i),
      amount: 80 + (i * 17) % 240,
      denialReason: i % 7 === 0 ? 'Modifier 25 missing' : undefined,
      appealDeadline: i % 7 === 0 ? daysAgo(-12) : undefined,
    }));
  }

  timesheets(): Timesheet[] {
    return Array.from({ length: 16 }).map((_, i) => ({
      id: `ts-${i + 1}`,
      userId: pick(['u-nurse1', 'u-nurse2', 'u-ther1', 'u-soc1', 'u-nutr1'], i),
      shiftId: `sh-${(i % 20) + 1}`,
      clockIn: hoursAgo(48 - i * 2),
      clockOut: i % 5 === 0 ? undefined : hoursAgo(44 - i * 2),
      hours: i % 5 === 0 ? 0 : 4 + (i % 3),
      status: pick<Timesheet['status']>(['open', 'submitted', 'approved', 'approved', 'rejected', 'exported'], i),
      notes: i % 4 === 0 ? 'Missed lunch break' : undefined,
      approverId: i % 3 === 0 ? 'u-admin' : undefined,
    }));
  }

  // -----------------------------------------------------------------------
  // Tasks (kanban)
  // -----------------------------------------------------------------------
  tasks(): KanbanTask[] {
    const seeds: Array<Omit<KanbanTask, 'id' | 'createdAt'>> = [
      { title: 'Verify insulin co-sign',           status: 'todo',  assignee: 'u-nurse1', patientId: 'pat-1', due: hoursAgo(-3),  priority: 'urgent', tags: ['medication', 'safety'],   createdBy: 'u-doc1' },
      { title: 'Wound photo upload — pat-2',       status: 'todo',  assignee: 'u-nurse2', patientId: 'pat-2', due: hoursAgo(-5),  priority: 'high',   tags: ['wound-care'],                createdBy: 'u-nurse1' },
      { title: 'Family call re: hospice plan',     status: 'todo',  assignee: 'u-soc1',   patientId: 'pat-3', due: hoursAgo(-8),  priority: 'high',   tags: ['family', 'hospice'],         createdBy: 'u-soc1' },
      { title: 'Restock dressing kits at HQ',      status: 'todo',  assignee: 'u-disp1',                      due: hoursAgo(-12), priority: 'med',    tags: ['inventory'],                 createdBy: 'u-admin' },
      { title: 'Renewal: PT eval for pat-7',       status: 'todo',  assignee: 'u-ther1',  patientId: 'pat-7', due: hoursAgo(-24), priority: 'med',    tags: ['therapy'],                   createdBy: 'u-ther1' },
      { title: 'Refill Lisinopril — pat-1',        status: 'doing', assignee: 'u-nurse1', patientId: 'pat-1', due: hoursAgo(2),   priority: 'high',   tags: ['medication'],                createdBy: 'u-nurse1' },
      { title: 'Dietary consult pat-4',            status: 'doing', assignee: 'u-nutr1',  patientId: 'pat-4', due: hoursAgo(1),   priority: 'med',    tags: ['nutrition'],                 createdBy: 'u-nutr1' },
      { title: 'Discharge paperwork pat-8',        status: 'doing', assignee: 'u-admin',  patientId: 'pat-8', due: hoursAgo(4),   priority: 'low',    tags: ['admin'],                     createdBy: 'u-admin' },
      { title: 'Audit denied claims batch',        status: 'doing', assignee: 'u-bill1',                      due: hoursAgo(6),   priority: 'high',   tags: ['billing'],                   createdBy: 'u-bill1' },
      { title: 'Telehealth setup — pat-5',         status: 'doing', assignee: 'u-doc1',   patientId: 'pat-5', due: hoursAgo(8),   priority: 'med',    tags: ['telehealth'],                createdBy: 'u-doc1' },
      { title: 'Recertify care plan pat-2',        status: 'done',  assignee: 'u-doc2',   patientId: 'pat-2', due: hoursAgo(36),  priority: 'med',    tags: ['care-plan'],                 createdBy: 'u-doc2' },
      { title: 'Update allergy list pat-1',        status: 'done',  assignee: 'u-nurse1', patientId: 'pat-1', due: hoursAgo(48),  priority: 'low',    tags: ['charting'],                  createdBy: 'u-nurse1' },
      { title: 'Inventory cycle count',            status: 'done',  assignee: 'u-disp1',                      due: hoursAgo(60),  priority: 'low',    tags: ['inventory'],                 createdBy: 'u-admin' },
      { title: 'Submit timesheets — week 32',      status: 'done',  assignee: 'u-bill1',                      due: hoursAgo(72),  priority: 'low',    tags: ['billing'],                   createdBy: 'u-bill1' },
      { title: 'Onboarding packet — new HHA',      status: 'done',  assignee: 'u-admin',                      due: hoursAgo(80),  priority: 'low',    tags: ['hr'],                        createdBy: 'u-admin' },
    ];
    return seeds.map((s, i) => ({
      ...s,
      id: `tsk-${i + 1}`,
      createdAt: daysAgo(3 + (i % 5)),
      estimateMin: 15 + (i * 7) % 45,
    }));
  }

  // -----------------------------------------------------------------------
  // Wounds
  // -----------------------------------------------------------------------
  wounds(): WoundAssessment[] {
    return [
      { id: 'wnd-1', patientId: 'pat-2', location: 'Sacrum',         stage: 'II',     lengthCm: 3.2, widthCm: 2.4, depthCm: 0.3, exudate: 'serous',         odor: 'none',     periWound: 'Intact, mild erythema', pain: 3, notes: 'Improving with dressing change q3d',  photos: [], assessedAt: daysAgo(2), assessedBy: 'u-nurse1', trend: 'improving' },
      { id: 'wnd-2', patientId: 'pat-7', location: 'Right heel',     stage: 'I',      lengthCm: 1.8, widthCm: 1.2, depthCm: 0.0, exudate: 'none',           odor: 'none',     periWound: 'Non-blanchable redness',   pain: 1, notes: 'Offloading boot applied',              photos: [], assessedAt: daysAgo(1), assessedBy: 'u-nurse2', trend: 'stable'    },
      { id: 'wnd-3', patientId: 'pat-3', location: 'Left ischial',   stage: 'III',    lengthCm: 4.0, widthCm: 3.0, depthCm: 0.8, exudate: 'serosanguineous', odor: 'mild',     periWound: 'Macerated edges',          pain: 5, notes: 'Hospice comfort measures',            photos: [], assessedAt: daysAgo(3), assessedBy: 'u-nurse1', trend: 'worsening' },
    ];
  }

  // -----------------------------------------------------------------------
  // Incidents
  // -----------------------------------------------------------------------
  incidents(): Incident[] {
    return [
      { id: 'inc-1', patientId: 'pat-2', kind: 'fall',     severity: 'med',     status: 'mitigated',     occurredAt: daysAgo(4),  reportedBy: 'u-nurse2', reportedAt: daysAgo(4),  summary: 'Found on floor next to bed, no injury.',              witnesses: ['u-fam1'], correctiveActions: ['Bed alarm installed', 'PT re-eval ordered'] },
      { id: 'inc-2', patientId: 'pat-1', kind: 'med-error',severity: 'high',    status: 'investigating', occurredAt: daysAgo(7),  reportedBy: 'u-nurse1', reportedAt: daysAgo(7),  summary: 'Insulin given 30 min late, double-verify missed.',     witnesses: [],            correctiveActions: ['Re-education scheduled'] },
      { id: 'inc-3', patientId: 'pat-6', kind: 'elopement',severity: 'critical',status: 'closed',        occurredAt: daysAgo(21), reportedBy: 'u-soc1',   reportedAt: daysAgo(21), summary: 'Left residence, located by family 2 hours later.',    witnesses: [],            correctiveActions: ['GPS bracelet provided', '24h aide added'], closedAt: daysAgo(20), closedBy: 'u-admin' },
      { id: 'inc-4', patientId: 'pat-3', kind: 'skin-event',severity: 'med',    status: 'open',          occurredAt: hoursAgo(20), reportedBy: 'u-nurse1', reportedAt: hoursAgo(19), summary: 'New reddened area on coccyx, no break in skin.',       witnesses: [],            correctiveActions: [] },
    ];
  }

  // -----------------------------------------------------------------------
  // Audit
  // -----------------------------------------------------------------------
  auditEntries(): AuditEntry[] {
    const actions: AuditAction[] = ['login', 'view', 'update', 'create', 'sign', 'export', 'role-switch'];
    const resources = [
      'patient:pat-1', 'patient:pat-2', 'patient:pat-4', 'medication:med-1', 'medication:med-5',
      'shift:sh-1', 'invoice:inv-1', 'claim:clm-3', 'wound:wnd-1', 'task:tsk-1', 'channel:ch-1',
    ];
    const out: AuditEntry[] = [];
    for (let i = 0; i < 30; i++) {
      const u = pick(MOCK_USERS, i);
      const action = pick(actions, i);
      out.push({
        id: `aud-${i + 1}`,
        ts: minutesAgo(i * 14 + 1),
        action,
        userId: u.id,
        userName: u.name,
        resource: pick(resources, i),
        meta: { ip: '10.0.0.' + (10 + (i % 50)), ua: 'web' },
      });
    }
    return out;
  }
  // -----------------------------------------------------------------------
  // Inventory
  // -----------------------------------------------------------------------
  inventory(): InventoryItem[] {
    return [
      { sku: 'WC-GLV-M',   name: 'Nitrile Gloves (M)',     category: 'PPE',       onHand: 240, par: 200, reorderAt: 100, expiresAt: daysAgo(-540), supplier: 'MedLine',     unitCost: 0.12 },
      { sku: 'WC-MSK-N95', name: 'N95 Respirator',         category: 'PPE',       onHand: 36,  par: 60,  reorderAt: 30,  expiresAt: daysAgo(-720), supplier: '3M',         unitCost: 1.85 },
      { sku: 'WC-DRS-2x2', name: 'Gauze 2x2',              category: 'Wound',     onHand: 480, par: 400, reorderAt: 200, expiresAt: daysAgo(-900), supplier: 'Cardinal',   unitCost: 0.08 },
      { sku: 'WC-ALOE-4',  name: 'Skin Barrier Spray 4oz', category: 'Skin',      onHand: 12,  par: 24,  reorderAt: 10,  expiresAt: daysAgo(-300), supplier: 'Coloplast',  unitCost: 6.50 },
      { sku: 'WC-INS-18u', name: 'Insulin Syringes 1ml',   category: 'Med',       onHand: 80,  par: 100, reorderAt: 40,  expiresAt: daysAgo(-365), supplier: 'BD',         unitCost: 0.18 },
      { sku: 'WC-POX',     name: 'Fingertip Pulse Oximeter', category: 'Equipment', onHand: 6,   par: 8,   reorderAt: 3,   expiresAt: undefined,        supplier: 'Nonin',      unitCost: 24.00 },
      { sku: 'WC-SCL',     name: 'Bathroom Scale',         category: 'Equipment', onHand: 2,   par: 4,   reorderAt: 2,   expiresAt: undefined,        supplier: 'Health-o-Meter', unitCost: 65.00 },
      { sku: 'WC-THM-F',   name: 'Temporal Thermometer',   category: 'Equipment', onHand: 4,   par: 6,   reorderAt: 2,   expiresAt: undefined,        supplier: 'Exergen',    unitCost: 110.00 },
      { sku: 'WC-WPE-PK',  name: 'Adult Wipes (pack)',     category: 'Hygiene',   onHand: 96,  par: 120, reorderAt: 50,  expiresAt: daysAgo(-600), supplier: 'TENA',       unitCost: 4.20 },
      { sku: 'WC-BRF-L',   name: 'Briefs Size L',          category: 'Hygiene',   onHand: 22,  par: 40,  reorderAt: 20,  expiresAt: daysAgo(-800), supplier: 'TENA',       unitCost: 1.10 },
      { sku: 'WC-GEL-4',   name: 'Hydrogel 4oz',           category: 'Wound',     onHand: 14,  par: 20,  reorderAt: 8,   expiresAt: daysAgo(-365), supplier: 'Cardinal',   unitCost: 3.20 },
      { sku: 'WC-SHMP',    name: 'No-Rinse Shampoo',       category: 'Hygiene',   onHand: 18,  par: 24,  reorderAt: 10,  expiresAt: daysAgo(-450), supplier: 'Sage',       unitCost: 5.40 },
      { sku: 'WC-MLK-6',   name: 'Ensure Plus 6-pack',     category: 'Nutrition', onHand: 24,  par: 36,  reorderAt: 12,  expiresAt: daysAgo(-180), supplier: 'Abbott',     unitCost: 11.50 },
      { sku: 'WC-THICK',   name: 'Thick-It Powder',        category: 'Nutrition', onHand: 8,   par: 12,  reorderAt: 6,   expiresAt: daysAgo(-400), supplier: 'Kent',       unitCost: 7.80 },
      { sku: 'WC-BP-CUF',  name: 'BP Cuff, Adult',         category: 'Equipment', onHand: 5,   par: 8,   reorderAt: 3,   expiresAt: undefined,        supplier: 'Welch Allyn',unitCost: 38.00 },
      { sku: 'WC-STETH',   name: 'Stethoscope',            category: 'Equipment', onHand: 7,   par: 10,  reorderAt: 4,   expiresAt: undefined,        supplier: '3M Littmann',unitCost: 95.00 },
      { sku: 'WC-HND-SAN', name: 'Hand Sanitizer 8oz',     category: 'PPE',       onHand: 32,  par: 48,  reorderAt: 16,  expiresAt: daysAgo(-720), supplier: 'GOJO',       unitCost: 4.20 },
      { sku: 'WC-CONT',    name: 'Sharps Container 1gal',  category: 'Other',     onHand: 9,   par: 12,  reorderAt: 4,   expiresAt: undefined,        supplier: 'Cardinal',   unitCost: 8.50 },
    ];
  }

  // -----------------------------------------------------------------------
  // Family updates (used by family portal)
  // -----------------------------------------------------------------------
  familyUpdates(): { id: string; patientId: string; ts: string; author: string; mood: 'great' | 'okay' | 'low'; note: string; photo?: string }[] {
    return [
      { id: 'upd-1', patientId: 'pat-1', ts: hoursAgo(3),  author: 'Maya Patel',   mood: 'great', note: 'Slept well, ate 90% of breakfast. Walked 50ft with the walker today!' },
      { id: 'upd-2', patientId: 'pat-1', ts: hoursAgo(27), author: 'Tomás Reyes',  mood: 'okay',  note: 'Mildly fatigued this morning, vitals stable. Took a short nap after lunch.' },
      { id: 'upd-3', patientId: 'pat-1', ts: hoursAgo(50), author: 'Maya Patel',   mood: 'great', note: 'Watched the Giants game with a huge smile. Family photo on the fridge made his day.' },
      { id: 'upd-4', patientId: 'pat-1', ts: daysAgo(3),   author: 'Yuki Tanaka',  mood: 'okay',  note: 'New renal-friendly menu approved by Dr. Park. Lunch was a hit.' },
      { id: 'upd-5', patientId: 'pat-1', ts: daysAgo(4),   author: 'Ines Costa',   mood: 'low',   note: 'Slower PT session today, knee stiff. Ice pack helped.' },
    ];
  }
}
