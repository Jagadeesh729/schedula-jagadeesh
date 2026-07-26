import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AppointmentService } from './appointment.service';

describe('AppointmentService', () => {
  const makeService = () => {
    const appointmentRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    const configRepo = { findOne: jest.fn() };
    const doctorProfileRepo = { findOne: jest.fn() };
    const recurringRepo = { find: jest.fn() };
    const customRepo = { find: jest.fn() };
    const slotGenService = {
      generateSlotsForWindow: jest.fn(),
      timeToMinutes: jest.fn(),
    };
    const waveBookingService = { bookWaveToken: jest.fn() };

    const service = new AppointmentService(
      appointmentRepo as any,
      configRepo as any,
      doctorProfileRepo as any,
      recurringRepo as any,
      customRepo as any,
      slotGenService as any,
      waveBookingService as any,
    );

    return { service, doctorProfileRepo, configRepo, appointmentRepo };
  };

  it('requires an authenticated patient to create appointments', async () => {
    const { service } = makeService();

    await expect(service.createAppointment({ doctorId: '123e4567-e89b-12d3-a456-426614174000', date: '2026-08-01' } as any)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects doctors creating appointments', async () => {
    const { service } = makeService();

    await expect(service.createAppointment({ doctorId: '123e4567-e89b-12d3-a456-426614174000', date: '2026-08-01' } as any, 'user-1', 'DOCTOR')).rejects.toThrow(ForbiddenException);
  });

  it('rejects patients reading another patient appointment', async () => {
    const { service, appointmentRepo } = makeService();
    appointmentRepo.findOne.mockResolvedValue({ id: 'appt-1', patientId: 'patient-b', doctorId: 'doctor-1' });

    await expect(service.getAppointmentById('appt-1', 'patient-a', 'PATIENT')).rejects.toThrow(ForbiddenException);
  });
});
