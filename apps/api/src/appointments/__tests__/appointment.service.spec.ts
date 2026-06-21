/**
 * apps/api/src/appointments/__tests__/appointment.service.spec.ts
 *
 * Unit tests for AppointmentService.
 *
 * The service injects the `KAFKA_PRODUCER` token (a TypedProducer) and calls
 * `createDb()` directly in its constructor. We mock `@caregiver/db` and
 * `drizzle-orm` via `vi.mock()` (using `vi.hoisted()` to share mutable result
 * containers) and provide a mock producer through the NestJS testing module.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AppointmentService } from '../appointment.service.js';
import { KAFKA_PRODUCER } from '../../kafka/kafka.module.js';

// ── Hoisted mock state ──────────────────────────────────────────
const mockState = vi.hoisted(() => {
  // Mutable result containers — tests set these before invoking the service.
  const selectResult = { current: [] as unknown[] };
  const insertResult = { current: [] as unknown[] };
  const updateResult = { current: [] as unknown[] };

  /**
   * Build a chainable Drizzle query mock.
   * Every chain method returns the chain itself; the terminal methods
   * (`limit`, `returning`) resolve to the current value of `ref.current`.
   */
  const makeChain = (ref: { current: unknown[] }) => {
    const c: Record<string, ReturnType<typeof vi.fn>> = {};
    c.from = vi.fn(() => c);
    c.where = vi.fn(() => c);
    c.orderBy = vi.fn(() => c);
    c.limit = vi.fn(() => Promise.resolve(ref.current));
    c.values = vi.fn(() => c);
    c.set = vi.fn(() => c);
    c.returning = vi.fn(() => Promise.resolve(ref.current));
    return c;
  };

  const selectChain = makeChain(selectResult);
  const insertChain = makeChain(insertResult);
  const updateChain = makeChain(updateResult);

  const db = {
    select: vi.fn(() => selectChain),
    insert: vi.fn(() => insertChain),
    update: vi.fn(() => updateChain),
  };

  return { db, selectResult, insertResult, updateResult };
});

// Mock drizzle-orm — `eq` is only used to build a WHERE clause that the
// chainable mock ignores, so a no-op stub is sufficient.
vi.mock('drizzle-orm', () => ({
  eq: vi.fn(() => ({})),
  desc: vi.fn(() => ({})),
}));

// Mock @caregiver/db — createDb returns our chainable mock DB; schema is a
// dummy object whose properties are never inspected at runtime.
vi.mock('@caregiver/db', () => ({
  createDb: () => mockState.db,
  schema: {
    users: { id: 'id', email: 'email' },
    appointments: { id: 'id' },
    vitals: { id: 'id', patientId: 'patientId', recordedAt: 'recordedAt' },
    aiDiagnoses: { id: 'id' },
  },
}));

describe('AppointmentService', () => {
  let service: AppointmentService;
  let producer: { send: ReturnType<typeof vi.fn> };

  // Canonical appointment row returned by the DB.
  const mockAppointment = {
    id: 'apt-123',
    fhirId: null,
    patientId: 'patient-1',
    practitionerId: 'doctor-1',
    status: 'booked',
    start: new Date('2024-06-10T09:00:00Z'),
    end: new Date('2024-06-10T09:30:00Z'),
    reason: 'Follow-up consultation',
    notes: null,
    createdAt: new Date('2024-06-01T00:00:00Z'),
    updatedAt: new Date('2024-06-01T00:00:00Z'),
  };

  beforeEach(async () => {
    // Reset result containers + producer before each test.
    mockState.selectResult.current = [];
    mockState.insertResult.current = [];
    mockState.updateResult.current = [];

    producer = { send: vi.fn().mockResolvedValue(undefined) };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentService,
        { provide: KAFKA_PRODUCER, useValue: producer },
      ],
    }).compile();

    service = moduleRef.get(AppointmentService);
  });

  // ── create() ─────────────────────────────────────────────────

  describe('create()', () => {
    it('inserts to the DB, emits a Kafka event, and returns the response', async () => {
      mockState.insertResult.current = [mockAppointment];

      const result = await service.create(
        {
          patientId: 'patient-1',
          practitionerId: 'doctor-1',
          start: '2024-06-10T09:00:00Z',
          end: '2024-06-10T09:30:00Z',
          reason: 'Follow-up consultation',
        },
        'doctor-1',
        'doctor',
      );

      // DB insert was invoked.
      expect(mockState.db.insert).toHaveBeenCalledTimes(1);

      // Kafka event emitted with the 'appointment.created' topic.
      expect(producer.send).toHaveBeenCalledWith(
        'appointment.created',
        expect.objectContaining({
          appointmentId: 'apt-123',
          patientId: 'patient-1',
          practitionerId: 'doctor-1',
        }),
        expect.objectContaining({ userId: 'doctor-1', userRole: 'doctor' }),
      );

      // Response maps the DB row to the API DTO.
      expect(result).toEqual({
        id: 'apt-123',
        fhirId: undefined,
        patientId: 'patient-1',
        practitionerId: 'doctor-1',
        status: 'booked',
        start: '2024-06-10T09:00:00.000Z',
        end: '2024-06-10T09:30:00.000Z',
        reason: 'Follow-up consultation',
        notes: undefined,
        createdAt: '2024-06-01T00:00:00.000Z',
        updatedAt: '2024-06-01T00:00:00.000Z',
      });
    });
  });

  // ── getById() ────────────────────────────────────────────────

  describe('getById()', () => {
    it('returns the appointment when the ID exists', async () => {
      mockState.selectResult.current = [mockAppointment];

      const result = await service.getById('apt-123');

      expect(result.id).toBe('apt-123');
      expect(result.patientId).toBe('patient-1');
      expect(result.status).toBe('booked');
    });

    it('throws NotFoundException when the ID does not exist', async () => {
      mockState.selectResult.current = []; // no rows

      await expect(service.getById('missing-id')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  // ── update() ─────────────────────────────────────────────────

  describe('update()', () => {
    it('updates the DB and emits a Kafka event', async () => {
      // First select (fetch current) returns the existing row.
      mockState.selectResult.current = [mockAppointment];
      // Update returning() returns the updated row.
      const updatedRow = {
        ...mockAppointment,
        status: 'cancelled',
        updatedAt: new Date('2024-06-02T00:00:00Z'),
      };
      mockState.updateResult.current = [updatedRow];

      const result = await service.update(
        'apt-123',
        { status: 'cancelled' },
        'doctor-1',
        'doctor',
      );

      // DB update was invoked.
      expect(mockState.db.update).toHaveBeenCalledTimes(1);

      // Kafka event emitted with the 'appointment.updated' topic.
      expect(producer.send).toHaveBeenCalledWith(
        'appointment.updated',
        expect.objectContaining({
          appointmentId: 'apt-123',
          previousStatus: 'booked',
          newStatus: 'cancelled',
        }),
        expect.objectContaining({ userId: 'doctor-1', userRole: 'doctor' }),
      );

      // Response reflects the updated status.
      expect(result.id).toBe('apt-123');
      expect(result.status).toBe('cancelled');
    });

    it('throws NotFoundException when the appointment does not exist', async () => {
      mockState.selectResult.current = []; // current row not found

      await expect(
        service.update('missing-id', { status: 'cancelled' }, 'doctor-1', 'doctor'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
