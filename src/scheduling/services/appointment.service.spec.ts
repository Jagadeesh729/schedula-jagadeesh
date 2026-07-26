import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AppointmentService } from './appointment.service';
import { Appointment } from '../entities/appointment.entity';
import { SchedulingConfig } from '../entities/scheduling-config.entity';
import { DoctorProfile } from '../../doctor/entities/doctor-profile.entity';
import { RecurringAvailability } from '../../doctor/entities/recurring-availability.entity';
import { CustomAvailability } from '../../doctor/entities/custom-availability.entity';
import { SlotGenerationService } from './slot-generation.service';
import { WaveBookingService } from './wave-booking.service';
import { CreateAppointmentDto } from '../dto/create-appointment.dto';

describe('AppointmentService', () => {
  const makeService = () => {
    const appointmentRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as Repository<Appointment>;
    const configRepo = {
      findOne: jest.fn(),
    } as unknown as Repository<SchedulingConfig>;
    const doctorProfileRepo = {
      findOne: jest.fn(),
    } as unknown as Repository<DoctorProfile>;
    const recurringRepo = {
      find: jest.fn(),
    } as unknown as Repository<RecurringAvailability>;
    const customRepo = {
      find: jest.fn(),
    } as unknown as Repository<CustomAvailability>;
    const slotGenService = {
      generateSlotsForWindow: jest.fn(),
      timeToMinutes: jest.fn(),
    } as unknown as SlotGenerationService;
    const waveBookingService = {
      bookWaveToken: jest.fn(),
    } as unknown as WaveBookingService;

    const service = new AppointmentService(
      appointmentRepo,
      configRepo,
      doctorProfileRepo,
      recurringRepo,
      customRepo,
      slotGenService,
      waveBookingService,
    );

    return {
      service,
      doctorProfileRepo,
      configRepo,
      appointmentRepo: appointmentRepo as unknown as Record<string, jest.Mock>,
    };
  };

  it('requires an authenticated patient to create appointments', async () => {
    const { service } = makeService();
    const dto: CreateAppointmentDto = {
      doctorId: '123e4567-e89b-12d3-a456-426614174000',
      date: '2026-08-01',
    };

    await expect(service.createAppointment(dto)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects doctors creating appointments', async () => {
    const { service } = makeService();
    const dto: CreateAppointmentDto = {
      doctorId: '123e4567-e89b-12d3-a456-426614174000',
      date: '2026-08-01',
    };

    await expect(
      service.createAppointment(dto, 'user-1', 'DOCTOR'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects patients reading another patient appointment', async () => {
    const { service, appointmentRepo } = makeService();
    appointmentRepo.findOne.mockResolvedValue({
      id: 'appt-1',
      patientId: 'patient-b',
      doctorId: 'doctor-1',
    });

    await expect(
      service.getAppointmentById('appt-1', 'patient-a', 'PATIENT'),
    ).rejects.toThrow(ForbiddenException);
  });
});
