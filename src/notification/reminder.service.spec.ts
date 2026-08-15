import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ReminderService } from './reminder.service';
import { NotificationService } from './notification.service';
import { Appointment } from '../scheduling/entities/appointment.entity';
import { AppointmentStatus } from '../scheduling/enums/appointment-status.enum';
import { SchedulingType } from '../scheduling/enums/scheduling-type.enum';
import { NotificationType } from './enums/notification-type.enum';
import { DataSource, Repository } from 'typeorm';

import { CreateNotificationDto } from './dto/notification.dto';
import { Notification } from './entities/notification.entity';

describe('ReminderService', () => {
  let service: ReminderService;
  let appointmentRepo: Record<string, jest.Mock>;
  let notificationService: {
    createNotification: jest.Mock<
      Promise<Notification>,
      [CreateNotificationDto]
    >;
  };

  const baseDateStr = '2026-08-16';

  beforeEach(async () => {
    appointmentRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
    };

    notificationService = {
      createNotification: jest.fn<
        Promise<Notification>,
        [CreateNotificationDto]
      >(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReminderService,
        {
          provide: getRepositoryToken(Appointment),
          useValue: appointmentRepo,
        },
        {
          provide: NotificationService,
          useValue: notificationService,
        },
      ],
    }).compile();

    service = module.get<ReminderService>(ReminderService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processAppointmentReminders', () => {
    it('should process and create STREAM reminder for eligible appointment within window', async () => {
      const mockAppt = {
        id: 'appt-stream-1',
        patientId: 'patient-1',
        doctor: { id: 'doc-1', fullName: 'Sarah Connor' },
        scheduleType: SchedulingType.STREAM,
        status: AppointmentStatus.CONFIRMED,
        date: baseDateStr,
        slotStartTime: '10:00',
        slotEndTime: '10:15',
      };

      appointmentRepo.find.mockResolvedValueOnce([mockAppt]);
      notificationService.createNotification.mockResolvedValueOnce({
        id: 'notif-1',
        eventId: 'reminder_appt-stream-1',
      } as unknown as Notification);

      process.env.REMINDER_WINDOW_MINUTES = '525600';

      const stats = await service.processAppointmentReminders();

      expect(stats.processed).toBe(1);
      expect(stats.created).toBe(1);
      expect(stats.duplicates).toBe(0);
      expect(stats.skipped).toBe(0);

      expect(notificationService.createNotification).toHaveBeenCalledTimes(1);
      const callArg = notificationService.createNotification.mock.calls[0][0];
      expect(callArg.patientId).toBe('patient-1');
      expect(callArg.type).toBe(NotificationType.APPOINTMENT_REMINDER);
      expect(callArg.message).toContain('Dr. Sarah Connor');
      expect(callArg.eventId).toBe('reminder_appt-stream-1');
    });

    it('should process and create WAVE reminder with reporting time and token number', async () => {
      const mockAppt = {
        id: 'appt-wave-1',
        patientId: 'patient-2',
        doctor: { id: 'doc-2', fullName: 'Dr. Gregory House' },
        scheduleType: SchedulingType.WAVE,
        status: AppointmentStatus.CONFIRMED,
        date: baseDateStr,
        window: '09:00 - 10:00',
        token: 3,
      };

      appointmentRepo.find.mockResolvedValueOnce([mockAppt]);
      notificationService.createNotification.mockResolvedValueOnce({
        id: 'notif-2',
        eventId: 'reminder_appt-wave-1',
      } as unknown as Notification);

      process.env.REMINDER_WINDOW_MINUTES = '525600';

      const stats = await service.processAppointmentReminders();

      expect(stats.created).toBe(1);
      expect(notificationService.createNotification).toHaveBeenCalledTimes(1);
      const waveCallArg =
        notificationService.createNotification.mock.calls[0][0];
      expect(waveCallArg.message).toContain(
        'Reporting Time: 09:00. Token Number: 3',
      );
      expect(waveCallArg.eventId).toBe('reminder_appt-wave-1');
    });

    it('should handle SQLSTATE 23505 unique constraint duplicate and increment duplicates counter', async () => {
      const mockAppt = {
        id: 'appt-dup-1',
        patientId: 'patient-3',
        doctor: { id: 'doc-3', fullName: 'Alan Grant' },
        scheduleType: SchedulingType.STREAM,
        status: AppointmentStatus.CONFIRMED,
        date: baseDateStr,
        slotStartTime: '14:00',
      };

      appointmentRepo.find.mockResolvedValueOnce([mockAppt]);
      notificationService.createNotification.mockRejectedValueOnce({
        code: '23505',
      });

      process.env.REMINDER_WINDOW_MINUTES = '525600';

      const stats = await service.processAppointmentReminders();

      expect(stats.processed).toBe(1);
      expect(stats.created).toBe(0);
      expect(stats.duplicates).toBe(1);
    });

    it('should record skip breakdown for incomplete data (missing patient or doctor)', async () => {
      const mockInvalid = {
        id: 'appt-invalid-1',
        patientId: null,
        doctor: null,
        status: AppointmentStatus.CONFIRMED,
        date: baseDateStr,
        slotStartTime: '11:00',
      };

      appointmentRepo.find.mockResolvedValueOnce([mockInvalid]);

      const stats = await service.processAppointmentReminders();

      expect(stats.processed).toBe(1);
      expect(stats.skipped).toBe(1);
      expect(stats.skippedBreakdown?.incompleteData).toBe(1);
    });

    it('should record skip breakdown for appointments outside window', async () => {
      const mockPastAppt = {
        id: 'appt-past-1',
        patientId: 'patient-4',
        doctor: { id: 'doc-4', fullName: 'Doc Brown' },
        scheduleType: SchedulingType.STREAM,
        status: AppointmentStatus.CONFIRMED,
        date: '2020-01-01',
        slotStartTime: '10:00',
      };

      appointmentRepo.find.mockResolvedValueOnce([mockPastAppt]);
      process.env.REMINDER_WINDOW_MINUTES = '60';

      const stats = await service.processAppointmentReminders();

      expect(stats.processed).toBe(1);
      expect(stats.skipped).toBe(1);
      expect(stats.skippedBreakdown?.outsideWindow).toBe(1);
    });
  });

  describe('Distributed Advisory Lock Coordination', () => {
    it('should skip execution when advisory lock is held by another cluster pod', async () => {
      const mockQueryRunner = {
        connect: jest.fn().mockResolvedValue(undefined),
        startTransaction: jest.fn().mockResolvedValue(undefined),
        query: jest.fn().mockResolvedValue([{ acquired: false }]),
        rollbackTransaction: jest.fn().mockResolvedValue(undefined),
        commitTransaction: jest.fn().mockResolvedValue(undefined),
        release: jest.fn().mockResolvedValue(undefined),
      };

      const mockDataSource = {
        isInitialized: true,
        createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
      } as unknown as DataSource;

      const clusterService = new ReminderService(
        appointmentRepo as unknown as Repository<Appointment>,
        notificationService as unknown as NotificationService,
        mockDataSource,
      );

      await clusterService.handleCronReminders();

      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('pg_try_advisory_xact_lock'),
      );
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(appointmentRepo.find).not.toHaveBeenCalled();
    });
  });
});
