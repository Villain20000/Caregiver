import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import {
  DatabaseState,
  User,
  Patient,
  VitalsReading,
  Medication,
  MedAdministration,
  ShiftEvent,
  GeoPoint,
  Channel,
  Message,
  Invoice,
  Claim,
  Timesheet,
  KanbanTask,
  WoundAssessment,
  Incident,
  AuditEntry,
  InventoryItem,
  FamilyUpdate,
  Role,
  VitalsFlag
} from './models/types';

const DATA_FILE_PATH = path.join(__dirname, '../data.json');

const SEED_NOW = Date.now();
const minutesAgo = (m: number) => new Date(SEED_NOW - m * 60_000).toISOString();
const hoursAgo = (h: number) => minutesAgo(h * 60);
const daysAgo = (d: number) => hoursAgo(d * 24);

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

const MOCK_USERS: User[] = [
  { id: 'u-admin',  name: 'Avery Quinn',      role: Role.ADMIN,          avatar: 'AQ', email: 'avery@carevibe.health',     phone: '+1 415 555 0101', credentials: ['MBA'],          online: true },
  { id: 'u-nurse1', name: 'Maya Patel',       role: Role.NURSE,          avatar: 'MP', email: 'maya@carevibe.health',      phone: '+1 415 555 0102', credentials: ['RN', 'BSN'],   homeBase: 'Mission District', online: true },
  { id: 'u-nurse2', name: 'Tomás Reyes',      role: Role.NURSE,          avatar: 'TR', email: 'tomas@carevibe.health',     phone: '+1 415 555 0103', credentials: ['LVN'],          homeBase: 'Sunset',          online: false },
  { id: 'u-doc1',   name: 'Dr. Lena Park',    role: Role.DOCTOR,         avatar: 'LP', email: 'lena@carevibe.health',      phone: '+1 415 555 0110', licenseNo: 'CA-A87412', npi: '1730194827' },
  { id: 'u-doc2',   name: 'Dr. Omar Faruq',   role: Role.DOCTOR,         avatar: 'OF', email: 'omar@carevibe.health',      phone: '+1 415 555 0111', licenseNo: 'CA-A91208' },
  { id: 'u-ther1',  name: 'Ines Costa',       role: Role.THERAPIST,      avatar: 'IC', email: 'ines@carevibe.health',      phone: '+1 415 555 0120', credentials: ['DPT'] },
  { id: 'u-soc1',   name: 'Jordan Hale',      role: Role.SOCIAL_WORKER,  avatar: 'JH', email: 'jordan@carevibe.health',    phone: '+1 415 555 0130', credentials: ['LCSW'] },
  { id: 'u-disp1',  name: 'Priya Shah',       role: Role.DISPATCHER,     avatar: 'PS', email: 'priya@carevibe.health',     phone: '+1 415 555 0140', online: true },
  { id: 'u-nutr1',  name: 'Chef Yuki Tanaka', role: Role.NUTRITIONIST,   avatar: 'YT', email: 'yuki@carevibe.health',      phone: '+1 415 555 0150', credentials: ['RD'] },
  { id: 'u-bill1',  name: 'Hank Liu',         role: Role.BILLING,        avatar: 'HL', email: 'hank@carevibe.health',      phone: '+1 415 555 0160', npi: '1382019945' },
  { id: 'u-fam1',   name: 'Sofia Mendes',     role: Role.FAMILY,         avatar: 'SM', email: 'sofia.m@gmail.com',         phone: '+1 415 555 0201' },
  { id: 'u-pat1',   name: 'Walter Mendes',    role: Role.PATIENT,        avatar: 'WM', email: 'walter.m@gmail.com',        phone: '+1 415 555 0202' },
];

function generateSeedData(): DatabaseState {
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

  const patientSeeds = [
    { id: 'pat-1', name: 'Walter Mendes',   age: 71, sex: 'M' as const, status: 'active' as const,     careLevel: 'skilled' as const,     primaryDx: dx(0), allergies: allergy(0), codeStatus: 'Full' as const, admitDate: daysAgo(34), payer: 'Medicare A', careTeam: [{ userId: 'u-doc1', role: Role.DOCTOR, lead: true }, { userId: 'u-nurse1', role: Role.NURSE }, { userId: 'u-ther1', role: Role.THERAPIST }, { userId: 'u-soc1', role: Role.SOCIAL_WORKER }, { userId: 'u-fam1', role: Role.FAMILY }], familyUserIds: ['u-fam1'] },
    { id: 'pat-2', name: 'Eleanor Whitlock', age: 82, sex: 'F' as const, status: 'active' as const,    careLevel: 'assisted' as const,    primaryDx: dx(1), allergies: allergy(1), codeStatus: 'DNR' as const, admitDate: daysAgo(56), payer: 'Medicare B', careTeam: [{ userId: 'u-doc2', role: Role.DOCTOR, lead: true }, { userId: 'u-nurse1', role: Role.NURSE }, { userId: 'u-soc1', role: Role.SOCIAL_WORKER }], familyUserIds: ['u-fam1'] },
    { id: 'pat-3', name: 'Reggie Okafor',   age: 67, sex: 'M' as const, status: 'active' as const,     careLevel: 'hospice' as const,     primaryDx: dx(2), allergies: allergy(2), codeStatus: 'Comfort' as const, admitDate: daysAgo(120), payer: 'Medicare A', careTeam: [{ userId: 'u-doc1', role: Role.DOCTOR, lead: true }, { userId: 'u-nurse2', role: Role.NURSE }, { userId: 'u-soc1', role: Role.SOCIAL_WORKER }], familyUserIds: ['u-fam1'] },
    { id: 'pat-4', name: 'Hana Lindqvist',  age: 58, sex: 'F' as const, status: 'active' as const,     careLevel: 'skilled' as const,     primaryDx: dx(3), allergies: allergy(3), codeStatus: 'Full' as const, admitDate: daysAgo(89), payer: 'BCBS', careTeam: [{ userId: 'u-doc2', role: Role.DOCTOR, lead: true }, { userId: 'u-nurse1', role: Role.NURSE }], familyUserIds: ['u-fam1'] },
    { id: 'pat-5', name: 'Idris Mahmoud',   age: 74, sex: 'M' as const, status: 'active' as const,     careLevel: 'independent' as const, primaryDx: dx(4), allergies: allergy(4), codeStatus: 'Full' as const, admitDate: daysAgo(15), payer: 'Self-pay', careTeam: [{ userId: 'u-doc1', role: Role.DOCTOR, lead: true }, { userId: 'u-nurse1', role: Role.NURSE }], familyUserIds: ['u-fam1'] },
    { id: 'pat-6', name: 'Yolanda Chen',    age: 79, sex: 'F' as const, status: 'on-hold' as const,    careLevel: 'assisted' as const,    primaryDx: dx(5), allergies: allergy(5), codeStatus: 'DNR/DNI' as const, admitDate: daysAgo(220), payer: 'Aetna', careTeam: [{ userId: 'u-doc2', role: Role.DOCTOR, lead: true }, { userId: 'u-soc1', role: Role.SOCIAL_WORKER }], familyUserIds: ['u-fam1'] },
    { id: 'pat-7', name: 'Marcus Bell',     age: 63, sex: 'M' as const, status: 'active' as const,     careLevel: 'skilled' as const,     primaryDx: dx(6), allergies: allergy(2), codeStatus: 'Full' as const, admitDate: daysAgo(48), payer: 'BCBS', careTeam: [{ userId: 'u-doc1', role: Role.DOCTOR, lead: true }, { userId: 'u-nurse1', role: Role.NURSE }, { userId: 'u-ther1', role: Role.THERAPIST }], familyUserIds: ['u-fam1'] },
    { id: 'pat-8', name: 'Aiyana Crow',     age: 55, sex: 'F' as const, status: 'discharged' as const, careLevel: 'independent' as const, primaryDx: dx(7), allergies: allergy(4), codeStatus: 'Full' as const, admitDate: daysAgo(360), payer: 'Aetna', careTeam: [{ userId: 'u-doc2', role: Role.DOCTOR, lead: true }], familyUserIds: ['u-fam1'] },
  ];
  const patients = patientSeeds.map((s, i) => ({
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

  const vitals: VitalsReading[] = [];
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
    vitals.push({
      id: `vtl-${i + 1}`,
      patientId,
      timestamp: minutesAgo(i * 27 + 5),
      hr, systolic: sys, diastolic: dia, glucose: glu, spo2, temp: Math.round(temp * 10) / 10,
      flag: (critical ? 'critical' : watch ? 'watch' : 'normal') as VitalsFlag,
      note: i % 6 === 0 ? 'Post-medication check' : undefined,
      recordedBy: pick(['u-nurse1', 'u-nurse2', 'u-doc1'], i),
    });
  }

  const medSeeds = [
    { name: 'Lisinopril', dose: '10 mg', route: 'PO', schedule: '08:00', riskLevel: 'moderate' as const, prescribedBy: 'u-doc1', doubleVerify: false, category: 'cardiac' as const, refillsRemaining: 3, patientId: 'pat-1', lastGiven: hoursAgo(6), lastGivenBy: 'u-nurse1' },
    { name: 'Metformin', dose: '500 mg', route: 'PO', schedule: '08:00, 20:00', riskLevel: 'low' as const, prescribedBy: 'u-doc1', doubleVerify: false, category: 'endocrine' as const, refillsRemaining: 5, patientId: 'pat-1', lastGiven: hoursAgo(2), lastGivenBy: 'u-nurse1' },
    { name: 'Furosemide', dose: '20 mg', route: 'PO', schedule: '08:00', riskLevel: 'moderate' as const, prescribedBy: 'u-doc1', doubleVerify: false, category: 'cardiac' as const, refillsRemaining: 2, patientId: 'pat-1', lastGiven: hoursAgo(8), lastGivenBy: 'u-nurse1' },
    { name: 'Insulin Glargine', dose: '18 units', route: 'SC', schedule: '21:00', riskLevel: 'high' as const, prescribedBy: 'u-doc1', doubleVerify: true, category: 'endocrine' as const, refillsRemaining: 1, patientId: 'pat-1', lastGiven: hoursAgo(11), lastGivenBy: 'u-nurse2' },
    { name: 'Apixaban', dose: '5 mg', route: 'PO', schedule: '08:00, 20:00', riskLevel: 'high' as const, prescribedBy: 'u-doc2', doubleVerify: true, category: 'cardiac' as const, refillsRemaining: 0, patientId: 'pat-2' },
    { name: 'Sertraline', dose: '50 mg', route: 'PO', schedule: '08:00', riskLevel: 'moderate' as const, prescribedBy: 'u-doc2', doubleVerify: false, category: 'psych' as const, refillsRemaining: 4, patientId: 'pat-2', lastGiven: hoursAgo(7), lastGivenBy: 'u-nurse1' },
    { name: 'Acetaminophen', dose: '650 mg', route: 'PO', schedule: 'Q6H PRN', riskLevel: 'low' as const, prescribedBy: 'u-doc1', doubleVerify: false, category: 'analgesic' as const, refillsRemaining: 6, patientId: 'pat-3', lastGiven: hoursAgo(3), lastGivenBy: 'u-nurse2' },
    { name: 'Morphine Sulfate', dose: '5 mg', route: 'PO', schedule: 'Q4H PRN', riskLevel: 'controlled' as const, prescribedBy: 'u-doc1', doubleVerify: true, category: 'analgesic' as const, refillsRemaining: 0, patientId: 'pat-3', lastGiven: hoursAgo(1), lastGivenBy: 'u-nurse1' },
    { name: 'Sevelamer', dose: '800 mg', route: 'PO', schedule: '08:00, 12:00, 18:00', riskLevel: 'moderate' as const, prescribedBy: 'u-doc1', doubleVerify: false, category: 'other' as const, refillsRemaining: 2, patientId: 'pat-4', lastGiven: hoursAgo(5), lastGivenBy: 'u-nurse1' },
    { name: 'Epoetin Alfa', dose: '4000 units', route: 'SC', schedule: 'M,W,F 09:00', riskLevel: 'high' as const, prescribedBy: 'u-doc1', doubleVerify: true, category: 'other' as const, refillsRemaining: 1, patientId: 'pat-4' },
    { name: 'Tiotropium', dose: '18 mcg', route: 'INH', schedule: '08:00', riskLevel: 'moderate' as const, prescribedBy: 'u-doc1', doubleVerify: false, category: 'other' as const, refillsRemaining: 3, patientId: 'pat-7', lastGiven: hoursAgo(9), lastGivenBy: 'u-nurse1' },
    { name: 'Vitamin D3', dose: '2000 IU', route: 'PO', schedule: '08:00', riskLevel: 'low' as const, prescribedBy: 'u-doc1', doubleVerify: false, category: 'supplement' as const, refillsRemaining: 8, patientId: 'pat-5', lastGiven: hoursAgo(10), lastGivenBy: 'u-nurse1' },
  ];
  const medications = medSeeds.map((s, i) => {
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

  const medAdministrations = Array.from({ length: 20 }).map((_, i) => ({
    id: `adm-${i + 1}`,
    medicationId: `med-${(i % 12) + 1}`,
    patientId: pick(['pat-1', 'pat-2', 'pat-3', 'pat-4', 'pat-7'], i),
    givenAt: hoursAgo(i * 4 + 2),
    givenBy: 'u-nurse1',
    verifiedBy: i % 4 === 0 ? 'u-nurse2' : undefined,
  }));

  const schedule: ShiftEvent[] = [];
  for (let i = 0; i < 20; i++) {
    const role = pick([Role.NURSE, Role.NURSE, Role.THERAPIST, Role.DISPATCHER, Role.SOCIAL_WORKER, Role.NUTRITIONIST], i);
    const user = MOCK_USERS.find((u) => u.role === role) ?? MOCK_USERS[1];
    const start = new Date();
    start.setHours(7 + (i % 12), 0, 0, 0);
    if (i < 8) start.setDate(start.getDate() - 1);
    const end = new Date(start);
    end.setHours(start.getHours() + (role === Role.THERAPIST ? 1 : role === Role.NUTRITIONIST ? 2 : 4));
    schedule.push({
      id: `sh-${i + 1}`,
      role,
      userId: user.id,
      patientId: i % 3 === 0 ? undefined : pick(['pat-1', 'pat-2', 'pat-4', 'pat-7'], i),
      start: start.toISOString(),
      end: end.toISOString(),
      geo: { lat: 37.77, lng: -122.42, label: pick(['Mission District', 'Sunset', 'Castro', 'Noe Valley', 'Bernal Heights'], i) },
      status: (i < 6 ? 'completed' : i < 14 ? 'scheduled' : i < 18 ? 'in-progress' : 'missed') as ShiftEvent['status'],
      visitType: pick(['routine', 'adl', 'wound', 'therapy', 'assessment', 'meal'], i) as ShiftEvent['visitType'],
      onCall: i % 5 === 0,
      notes: i % 4 === 0 ? 'Bring translation card' : undefined,
    });
  }

  const geoPoints = [
    { lat: 37.7599, lng: -122.4148, label: 'Mission District' },
    { lat: 37.7551, lng: -122.4923, label: 'Sunset' },
    { lat: 37.7609, lng: -122.4350, label: 'Castro' },
    { lat: 37.7510, lng: -122.4337, label: 'Bernal Heights' },
    { lat: 37.7510, lng: -122.4480, label: 'Noe Valley' },
    { lat: 37.7747, lng: -122.4885, label: 'Outer Richmond' },
    { lat: 37.7274, lng: -122.4760, label: 'Excelsior' },
    { lat: 37.7298, lng: -122.3933, label: 'Bayview' },
  ];

  const mkChannel = (id: string, name: string, kind: Channel['kind'], pinned: boolean, members: string[]): Channel => {
    const list = members.map((userId) => ({ userId, role: 'member' as const, lastRead: minutesAgo(Math.floor(Math.random() * 120)) }));
    return { id, name, kind, members: list, unread: Math.floor(Math.random() * 6), pinned, encrypted: kind !== 'direct', topic: kind === 'care-team' ? 'Care team coordination' : undefined };
  };

  const channels = [
    mkChannel('ch-1', '#mission-control',   'care-team', true,  ['u-admin', 'u-nurse1', 'u-doc1', 'u-disp1', 'u-bill1']),
    mkChannel('ch-2', '#medication-pass',   'clinical',  true,  ['u-nurse1', 'u-nurse2', 'u-doc1', 'u-doc2']),
    mkChannel('ch-3', '#family-mendes',     'family',    true,  ['u-fam1', 'u-nurse1', 'u-soc1', 'u-doc1']),
    mkChannel('ch-4', '#on-call-night',     'ops',       true,  ['u-disp1', 'u-nurse1', 'u-nurse2', 'u-doc2']),
    mkChannel('ch-5', 'DM: Maya ↔ Dr. Park','direct',    false, ['u-nurse1', 'u-doc1']),
    mkChannel('ch-6', '#wound-care-rounds', 'clinical',  true,  ['u-nurse1', 'u-doc1', 'u-ther1']),
    mkChannel('ch-7', '#billing-queue',     'ops',       true,  ['u-bill1', 'u-admin']),
    mkChannel('ch-8', '#nutrition-circle',  'care-team', true,  ['u-nutr1', 'u-nurse1', 'u-soc1', 'u-fam1']),
    mkChannel('ch-9', '#therapy-team',      'care-team', true,  ['u-ther1', 'u-doc1', 'u-nurse1']),
    mkChannel('ch-10','#dispatch-floor',    'ops',       true,  ['u-disp1', 'u-admin', 'u-nurse1', 'u-nurse2']),
  ];

  const messages: Message[] = [];
  const msgSamples = [
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
  msgSamples.forEach((m, i) => {
    messages.push({
      id: `msg-${i + 1}`,
      channelId: m.channelId,
      authorId: m.authorId,
      text: m.text,
      timestamp: minutesAgo(i * 11 + 3),
      reactions: i % 3 === 0 ? [{ emoji: '👍', userIds: ['u-admin', 'u-nurse2'] }] : undefined,
    });
  });

  channels.forEach((c) => {
    const chMsgs = messages.filter((m) => m.channelId === c.id).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    if (chMsgs.length > 0) {
      c.lastMessage = chMsgs[0];
    }
  });

  const cptTable: Array<[string, string, number]> = [
    ['99306', 'Nursing facility comprehensive', 285],
    ['99213', 'Office visit, established', 110],
    ['97110', 'Therapeutic exercises, 15 min', 35],
    ['97530', 'Therapeutic activities, 15 min', 42],
    ['G0438', 'Annual wellness visit', 165],
    ['99490', 'Chronic care management', 62],
  ];
  const invoices: Invoice[] = [];
  for (let i = 0; i < 12; i++) {
    const items = [];
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
    invoices.push({
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

  const claims = Array.from({ length: 14 }).map((_, i) => ({
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

  const timesheets = Array.from({ length: 16 }).map((_, i) => ({
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

  const taskSeeds = [
    { title: 'Verify insulin co-sign',           status: 'todo' as const,  assignee: 'u-nurse1', patientId: 'pat-1', due: hoursAgo(-3),  priority: 'urgent' as const, tags: ['medication', 'safety'],   createdBy: 'u-doc1' },
    { title: 'Wound photo upload — pat-2',       status: 'todo' as const,  assignee: 'u-nurse2', patientId: 'pat-2', due: hoursAgo(-5),  priority: 'high' as const,   tags: ['wound-care'],                createdBy: 'u-nurse1' },
    { title: 'Family call re: hospice plan',     status: 'todo' as const,  assignee: 'u-soc1',   patientId: 'pat-3', due: hoursAgo(-8),  priority: 'high' as const,   tags: ['family', 'hospice'],         createdBy: 'u-soc1' },
    { title: 'Restock dressing kits at HQ',      status: 'todo' as const,  assignee: 'u-disp1',                      due: hoursAgo(-12), priority: 'med' as const,    tags: ['inventory'],                 createdBy: 'u-admin' },
    { title: 'Renewal: PT eval for pat-7',       status: 'todo' as const,  assignee: 'u-ther1',  patientId: 'pat-7', due: hoursAgo(-24), priority: 'med' as const,    tags: ['therapy'],                   createdBy: 'u-ther1' },
    { title: 'Refill Lisinopril — pat-1',        status: 'doing' as const, assignee: 'u-nurse1', patientId: 'pat-1', due: hoursAgo(2),   priority: 'high' as const,   tags: ['medication'],                createdBy: 'u-nurse1' },
    { title: 'Dietary consult pat-4',            status: 'doing' as const, assignee: 'u-nutr1',  patientId: 'pat-4', due: hoursAgo(1),   priority: 'med' as const,    tags: ['nutrition'],                 createdBy: 'u-nutr1' },
    { title: 'Discharge paperwork pat-8',        status: 'doing' as const, assignee: 'u-admin',  patientId: 'pat-8', due: hoursAgo(4),   priority: 'low' as const,    tags: ['admin'],                     createdBy: 'u-admin' },
    { title: 'Audit denied claims batch',        status: 'doing' as const, assignee: 'u-bill1',                      due: hoursAgo(6),   priority: 'high' as const,   tags: ['billing'],                   createdBy: 'u-bill1' },
    { title: 'Telehealth setup — pat-5',         status: 'doing' as const, assignee: 'u-doc1',   patientId: 'pat-5', due: hoursAgo(8),   priority: 'med' as const,    tags: ['telehealth'],                createdBy: 'u-doc1' },
    { title: 'Recertify care plan pat-2',        status: 'done' as const,  assignee: 'u-doc2',   patientId: 'pat-2', due: hoursAgo(36),  priority: 'med' as const,    tags: ['care-plan'],                 createdBy: 'u-doc2' },
    { title: 'Update allergy list pat-1',        status: 'done' as const,  assignee: 'u-nurse1', patientId: 'pat-1', due: hoursAgo(48),  priority: 'low' as const,    tags: ['charting'],                  createdBy: 'u-nurse1' },
    { title: 'Inventory cycle count',            status: 'done' as const,  assignee: 'u-disp1',                      due: hoursAgo(60),  priority: 'low' as const,    tags: ['inventory'],                 createdBy: 'u-admin' },
    { title: 'Submit timesheets — week 32',      status: 'done' as const,  assignee: 'u-bill1',                      due: hoursAgo(72),  priority: 'low' as const,    tags: ['billing'],                   createdBy: 'u-bill1' },
    { title: 'Onboarding packet — new HHA',      status: 'done' as const,  assignee: 'u-admin',                      due: hoursAgo(80),  priority: 'low' as const,    tags: ['hr'],                        createdBy: 'u-admin' },
  ];
  const tasks = taskSeeds.map((s, i) => ({
    ...s,
    id: `tsk-${i + 1}`,
    createdAt: daysAgo(3 + (i % 5)),
    estimateMin: 15 + (i * 7) % 45,
  }));

  const wounds: WoundAssessment[] = [
    { id: 'wnd-1', patientId: 'pat-2', location: 'Sacrum',         stage: 'II' as const,     lengthCm: 3.2, widthCm: 2.4, depthCm: 0.3, exudate: 'serous' as const,         odor: 'none' as const,     periWound: 'Intact, mild erythema', pain: 3, notes: 'Improving with dressing change q3d',  photos: [], assessedAt: daysAgo(2), assessedBy: 'u-nurse1', trend: 'improving' as const },
    { id: 'wnd-2', patientId: 'pat-7', location: 'Right heel',     stage: 'I' as const,      lengthCm: 1.8, widthCm: 1.2, depthCm: 0.0, exudate: 'none' as const,           odor: 'none' as const,     periWound: 'Non-blanchable redness',   pain: 1, notes: 'Offloading boot applied',              photos: [], assessedAt: daysAgo(1), assessedBy: 'u-nurse2', trend: 'stable' as const    },
    { id: 'wnd-3', patientId: 'pat-3', location: 'Left ischial',   stage: 'III' as const,    lengthCm: 4.0, widthCm: 3.0, depthCm: 0.8, exudate: 'serosanguineous' as const, odor: 'mild' as const,     periWound: 'Macerated edges',          pain: 5, notes: 'Hospice comfort measures',            photos: [], assessedAt: daysAgo(3), assessedBy: 'u-nurse1', trend: 'worsening' as const },
  ];

  const incidents: Incident[] = [
    { id: 'inc-1', patientId: 'pat-2', kind: 'fall' as const,     severity: 'med' as const,     status: 'mitigated' as const,     occurredAt: daysAgo(4),  reportedBy: 'u-nurse2', reportedAt: daysAgo(4),  summary: 'Found on floor next to bed, no injury.',              witnesses: ['u-fam1'], correctiveActions: ['Bed alarm installed', 'PT re-eval ordered'] },
    { id: 'inc-2', patientId: 'pat-1', kind: 'med-error' as const,severity: 'high' as const,    status: 'investigating' as const, occurredAt: daysAgo(7),  reportedBy: 'u-nurse1', reportedAt: daysAgo(7),  summary: 'Insulin given 30 min late, double-verify missed.',     witnesses: [],            correctiveActions: ['Re-education scheduled'] },
    { id: 'inc-3', patientId: 'pat-6', kind: 'elopement' as const,severity: 'critical' as const,status: 'closed' as const,        occurredAt: daysAgo(21), reportedBy: 'u-soc1',   reportedAt: daysAgo(21), summary: 'Left residence, located by family 2 hours later.',    witnesses: [],            correctiveActions: ['GPS bracelet provided', '24h aide added'], closedAt: daysAgo(20), closedBy: 'u-admin' },
    { id: 'inc-4', patientId: 'pat-3', kind: 'skin-event' as const,severity: 'med' as const,    status: 'open' as const,          occurredAt: hoursAgo(20), reportedBy: 'u-nurse1', reportedAt: hoursAgo(19), summary: 'New reddened area on coccyx, no break in skin.',       witnesses: [],            correctiveActions: [] },
  ];

  const actions: AuditEntry['action'][] = ['login', 'view', 'update', 'create', 'sign', 'export', 'role-switch'];
  const resources = [
    'patient:pat-1', 'patient:pat-2', 'patient:pat-4', 'medication:med-1', 'medication:med-5',
    'shift:sh-1', 'invoice:inv-1', 'claim:clm-3', 'wound:wnd-1', 'task:tsk-1', 'channel:ch-1',
  ];
  const auditEntries: AuditEntry[] = [];
  for (let i = 0; i < 30; i++) {
    const u = pick(MOCK_USERS, i);
    const action = pick(actions, i);
    auditEntries.push({
      id: `aud-${i + 1}`,
      ts: minutesAgo(i * 14 + 1),
      action,
      userId: u.id,
      userName: u.name,
      resource: pick(resources, i),
      meta: { ip: '10.0.0.' + (10 + (i % 50)), ua: 'web' },
    });
  }

  const inventory: InventoryItem[] = [
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

  const familyUpdates = [
    { id: 'upd-1', patientId: 'pat-1', ts: hoursAgo(3),  author: 'Maya Patel',   mood: 'great' as const, note: 'Slept well, ate 90% of breakfast. Walked 50ft with the walker today!' },
    { id: 'upd-2', patientId: 'pat-1', ts: hoursAgo(27), author: 'Tomás Reyes',  mood: 'okay' as const,  note: 'Mildly fatigued this morning, vitals stable. Took a short nap after lunch.' },
    { id: 'upd-3', patientId: 'pat-1', ts: hoursAgo(50), author: 'Maya Patel',   mood: 'great' as const, note: 'Watched the Giants game with a huge smile. Family photo on the fridge made his day.' },
    { id: 'upd-4', patientId: 'pat-1', ts: daysAgo(3),   author: 'Yuki Tanaka',  mood: 'okay' as const,  note: 'New renal-friendly menu approved by Dr. Park. Lunch was a hit.' },
    { id: 'upd-5', patientId: 'pat-1', ts: daysAgo(4),   author: 'Ines Costa',   mood: 'low' as const,   note: 'Slower PT session today, knee stiff. Ice pack helped.' },
  ];

  return {
    users: MOCK_USERS,
    patients,
    vitals,
    medications,
    medAdministrations,
    schedule,
    geoPoints,
    channels,
    messages,
    invoices,
    claims,
    timesheets,
    tasks,
    wounds,
    incidents,
    auditEntries,
    inventory,
    familyUpdates,
  };
}

const TABLE_SCHEMAS: Record<string, string> = {
  users: `
    id VARCHAR PRIMARY KEY,
    name VARCHAR,
    role VARCHAR,
    avatar VARCHAR,
    email VARCHAR,
    phone VARCHAR,
    "licenseNo" VARCHAR,
    npi VARCHAR,
    credentials JSONB,
    "homeBase" VARCHAR,
    online BOOLEAN
  `,
  patients: `
    id VARCHAR PRIMARY KEY,
    mrn VARCHAR,
    name VARCHAR,
    dob VARCHAR,
    age INTEGER,
    sex VARCHAR,
    photo VARCHAR,
    address VARCHAR,
    "primaryDx" JSONB,
    allergies JSONB,
    "codeStatus" VARCHAR,
    "careLevel" VARCHAR,
    status VARCHAR,
    "admitDate" VARCHAR,
    payer VARCHAR,
    "careTeam" JSONB,
    "emergencyContact" JSONB,
    "riskFlags" JSONB,
    "familyUserIds" JSONB,
    notes TEXT
  `,
  vitals: `
    id VARCHAR PRIMARY KEY,
    "patientId" VARCHAR,
    timestamp VARCHAR,
    hr INTEGER,
    systolic INTEGER,
    diastolic INTEGER,
    glucose INTEGER,
    spo2 INTEGER,
    temp DOUBLE PRECISION,
    flag VARCHAR,
    note TEXT,
    "recordedBy" VARCHAR
  `,
  medications: `
    id VARCHAR PRIMARY KEY,
    name VARCHAR,
    dose VARCHAR,
    route VARCHAR,
    schedule VARCHAR,
    "riskLevel" VARCHAR,
    "prescribedBy" VARCHAR,
    "doubleVerify" BOOLEAN,
    category VARCHAR,
    "refillsRemaining" INTEGER,
    "patientId" VARCHAR,
    "lastGiven" VARCHAR,
    "lastGivenBy" VARCHAR,
    times JSONB
  `,
  medAdministrations: `
    id VARCHAR PRIMARY KEY,
    "medicationId" VARCHAR,
    "patientId" VARCHAR,
    "givenAt" VARCHAR,
    "givenBy" VARCHAR,
    "verifiedBy" VARCHAR,
    skipped BOOLEAN,
    reason TEXT
  `,
  schedule: `
    id VARCHAR PRIMARY KEY,
    role VARCHAR,
    "userId" VARCHAR,
    "patientId" VARCHAR,
    "start" VARCHAR,
    "end" VARCHAR,
    geo JSONB,
    status VARCHAR,
    "visitType" VARCHAR,
    "onCall" BOOLEAN,
    notes TEXT
  `,
  geoPoints: `
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    label VARCHAR PRIMARY KEY
  `,
  channels: `
    id VARCHAR PRIMARY KEY,
    name VARCHAR,
    kind VARCHAR,
    unread INTEGER,
    pinned BOOLEAN,
    encrypted BOOLEAN,
    topic VARCHAR,
    members JSONB,
    "lastMessage" JSONB
  `,
  messages: `
    id VARCHAR PRIMARY KEY,
    "channelId" VARCHAR,
    "authorId" VARCHAR,
    text TEXT,
    timestamp VARCHAR,
    reactions JSONB
  `,
  invoices: `
    id VARCHAR PRIMARY KEY,
    number VARCHAR,
    "patientId" VARCHAR,
    payer VARCHAR,
    "issuedAt" VARCHAR,
    "dueAt" VARCHAR,
    status VARCHAR,
    items JSONB,
    subtotal DOUBLE PRECISION,
    tax DOUBLE PRECISION,
    total DOUBLE PRECISION
  `,
  claims: `
    id VARCHAR PRIMARY KEY,
    "invoiceId" VARCHAR,
    cpt VARCHAR,
    "submittedAt" VARCHAR,
    status VARCHAR,
    payer VARCHAR,
    amount DOUBLE PRECISION,
    "denialReason" VARCHAR,
    "appealDeadline" VARCHAR
  `,
  timesheets: `
    id VARCHAR PRIMARY KEY,
    "userId" VARCHAR,
    "shiftId" VARCHAR,
    "clockIn" VARCHAR,
    "clockOut" VARCHAR,
    hours DOUBLE PRECISION,
    status VARCHAR,
    notes TEXT,
    "approverId" VARCHAR
  `,
  tasks: `
    id VARCHAR PRIMARY KEY,
    title VARCHAR,
    status VARCHAR,
    assignee VARCHAR,
    "patientId" VARCHAR,
    due VARCHAR,
    priority VARCHAR,
    tags JSONB,
    "createdBy" VARCHAR,
    "createdAt" VARCHAR,
    "estimateMin" INTEGER
  `,
  wounds: `
    id VARCHAR PRIMARY KEY,
    "patientId" VARCHAR,
    location VARCHAR,
    stage VARCHAR,
    "lengthCm" DOUBLE PRECISION,
    "widthCm" DOUBLE PRECISION,
    "depthCm" DOUBLE PRECISION,
    exudate VARCHAR,
    odor VARCHAR,
    "periWound" VARCHAR,
    pain INTEGER,
    notes TEXT,
    photos JSONB,
    "assessedAt" VARCHAR,
    "assessedBy" VARCHAR,
    trend VARCHAR
  `,
  incidents: `
    id VARCHAR PRIMARY KEY,
    "patientId" VARCHAR,
    kind VARCHAR,
    severity VARCHAR,
    status VARCHAR,
    "occurredAt" VARCHAR,
    "reportedBy" VARCHAR,
    "reportedAt" VARCHAR,
    summary TEXT,
    witnesses JSONB,
    "correctiveActions" JSONB,
    "closedAt" VARCHAR,
    "closedBy" VARCHAR
  `,
  auditEntries: `
    id VARCHAR PRIMARY KEY,
    ts VARCHAR,
    action VARCHAR,
    "userId" VARCHAR,
    "userName" VARCHAR,
    resource VARCHAR,
    meta JSONB
  `,
  inventory: `
    sku VARCHAR PRIMARY KEY,
    name VARCHAR,
    category VARCHAR,
    "onHand" INTEGER,
    par INTEGER,
    "reorderAt" INTEGER,
    "expiresAt" VARCHAR,
    supplier VARCHAR,
    "unitCost" DOUBLE PRECISION
  `,
  familyUpdates: `
    id VARCHAR PRIMARY KEY,
    "patientId" VARCHAR,
    ts VARCHAR,
    author VARCHAR,
    mood VARCHAR,
    note TEXT,
    photo VARCHAR
  `
};

export class DB {
  private pool = new Pool();

  async init() {
    console.log('Connecting to PostgreSQL database...');
    // Create tables
    for (const key of Object.keys(TABLE_SCHEMAS)) {
      const schema = TABLE_SCHEMAS[key];
      const createQuery = `CREATE TABLE IF NOT EXISTS "${key}" (${schema});`;
      await this.pool.query(createQuery);
    }
    console.log('All PostgreSQL tables verified/created successfully.');

    // Seed tables if empty
    let fileSeeds: any = null;
    if (fs.existsSync(DATA_FILE_PATH)) {
      try {
        const raw = fs.readFileSync(DATA_FILE_PATH, 'utf-8');
        fileSeeds = JSON.parse(raw);
        console.log('Found existing data.json file. Will use it for database seeding if empty.');
      } catch (e) {
        console.error('Failed to read data.json:', e);
      }
    }

    const backupSeeds = generateSeedData();

    for (const key of Object.keys(TABLE_SCHEMAS)) {
      const countRes = await this.pool.query(`SELECT COUNT(*) FROM "${key}"`);
      const count = parseInt(countRes.rows[0].count, 10);
      if (count === 0) {
        const seedItems = (fileSeeds && fileSeeds[key]) ? fileSeeds[key] : (backupSeeds as any)[key];
        if (seedItems && Array.isArray(seedItems)) {
          console.log(`Seeding table "${key}" with ${seedItems.length} records...`);
          await this.seedTable(key, seedItems);
        }
      }
    }
    console.log('Database initialization and seeding complete.');
  }

  private async seedTable(key: string, items: any[]) {
    for (const item of items) {
      await this.insert(key as any, item);
    }
  }

  // Getters & Setters
  async get<K extends keyof DatabaseState>(key: K): Promise<DatabaseState[K]> {
    const query = `SELECT * FROM "${key}"`;
    const res = await this.pool.query(query);
    return res.rows as any;
  }

  // Helper CRUD methods
  async insert<K extends keyof DatabaseState>(key: K, item: any): Promise<any> {
    const pk = key === 'inventory' ? 'sku' : key === 'geoPoints' ? 'label' : 'id';
    const keys = Object.keys(item);
    const columns = keys.map(k => `"${k}"`).join(', ');
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const values = keys.map(k => {
      const val = item[k];
      if (val && (Array.isArray(val) || typeof val === 'object')) {
        return JSON.stringify(val);
      }
      return val;
    });

    const updateSets = keys
      .map(k => `"${k}" = EXCLUDED."${k}"`)
      .filter((_, i) => keys[i] !== pk)
      .join(', ');

    const conflictClause = updateSets.length > 0
      ? `DO UPDATE SET ${updateSets}`
      : 'DO NOTHING';

    const query = `
      INSERT INTO "${key}" (${columns})
      VALUES (${placeholders})
      ON CONFLICT ("${pk}")
      ${conflictClause}
      RETURNING *
    `;
    const res = await this.pool.query(query, values);
    return res.rows[0];
  }

  async updateById<K extends keyof DatabaseState>(key: K, id: string, updater: (item: any) => any): Promise<any> {
    const pk = key === 'inventory' ? 'sku' : key === 'geoPoints' ? 'label' : 'id';
    const selectQuery = `SELECT * FROM "${key}" WHERE "${pk}" = $1`;
    const selectRes = await this.pool.query(selectQuery, [id]);
    if (selectRes.rows.length === 0) {
      return null;
    }
    const currentItem = selectRes.rows[0];
    const updatedFields = updater(currentItem);
    const updatedItem = { ...currentItem, ...updatedFields };
    return this.insert(key, updatedItem);
  }

  async deleteById<K extends keyof DatabaseState>(key: K, id: string): Promise<boolean> {
    const pk = key === 'inventory' ? 'sku' : key === 'geoPoints' ? 'label' : 'id';
    const query = `DELETE FROM "${key}" WHERE "${pk}" = $1`;
    const res = await this.pool.query(query, [id]);
    return (res.rowCount ?? 0) > 0;
  }
}

export const db = new DB();
