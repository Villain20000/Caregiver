import { Role } from './role.model';

export interface UserSession {
  id: string;
  name: string;
  role: Role;
  avatar: string;
}

export interface User {
  id: string;
  name: string;
  role: Role;
  avatar: string;          // URL or initials
  email: string;
  phone: string;
  licenseNo?: string;      // for clinicians
  npi?: string;            // for billing
  credentials?: string[];  // e.g. ['RN', 'BSN']
  homeBase?: string;       // for field staff
  online?: boolean;
}

export const MOCK_USERS: User[] = [
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
