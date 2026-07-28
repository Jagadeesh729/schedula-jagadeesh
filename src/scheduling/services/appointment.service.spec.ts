import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AppointmentService } from './appointment.service';
import { Appointment } from '../entities/appointment.entity';
import { SchedulingConfig } from '../entities/scheduling-config.entity';
import { DoctorProfile } from '../../doctor/entities/doctor-profile.entity';
import { PatientProfile } from '../../patient/entities/patient-profile.entity';
import { RecurringAvailability } from '../../doctor/entities/recurring-availability.entity';
import { CustomAvailability } from '../../doctor/entities/custom-availability.entity';
import { AppointmentStatus } from '../enums/appointment-status.enum';

describe('AppointmentService Unit Tests', () => {
  let service: AppointmentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentService,
        {
          provide: getRepositoryToken(Appointment),
          useValue: { findOne: jest.fn(), find: jest.fn(), create: jest.fn() },
        },
        {
          provide: getRepositoryToken(SchedulingConfig),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(DoctorProfile),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(PatientProfile),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(RecurringAvailability),
          useValue: { find: jest.fn() },
        },
        {
          provide: getRepositoryToken(CustomAvailability),
          useValue: { find: jest.fn() },
        },
        {
          provide: DataSource,
          useValue: { transaction: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<AppointmentService>(AppointmentService);
  });

  it('should generate STREAM slots correctly for 10:00-11:00 with 15min slots and 5min buffer', () => {
    const slots = service.generateSlotsForWindow('10:00', '11:00', 15, 5, []);
    expect(slots).toHaveLength(3);
    expect(slots[0]).toEqual({
      startTime: '10:00',
      endTime: '10:15',
      available: true,
    });
    expect(slots[1]).toEqual({
      startTime: '10:20',
      endTime: '10:35',
      available: true,
    });
    expect(slots[2]).toEqual({
      startTime: '10:40',
      endTime: '10:55',
      available: true,
    });
  });

  it('should mark STREAM slot unavailable if booked', () => {
    const booked = [
      {
        id: '1',
        slotStartTime: '10:00',
        slotEndTime: '10:15',
        status: AppointmentStatus.CONFIRMED,
      } as Appointment,
    ];
    const slots = service.generateSlotsForWindow(
      '10:00',
      '11:00',
      15,
      5,
      booked,
    );
    expect(slots[0].available).toBe(false);
    expect(slots[1].available).toBe(true);
  });

  it('should mark STREAM slot available if appointment is CANCELLED', () => {
    const booked = [
      {
        id: '1',
        slotStartTime: '10:00',
        slotEndTime: '10:15',
        status: AppointmentStatus.CANCELLED,
      } as Appointment,
    ];
    const slots = service.generateSlotsForWindow(
      '10:00',
      '11:00',
      15,
      5,
      booked,
    );
    expect(slots[0].available).toBe(true);
  });
});
