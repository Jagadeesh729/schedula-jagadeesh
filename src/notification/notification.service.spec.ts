import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { Notification } from './entities/notification.entity';
import { PatientProfile } from '../patient/entities/patient-profile.entity';
import { NotificationType } from './enums/notification-type.enum';

const makeNotif = (overrides: Partial<Notification> = {}): Notification =>
  ({
    id: 'notif-uuid-1',
    patientId: 'patient-uuid-1',
    type: NotificationType.APPOINTMENT_BOOKED,
    title: 'Appointment Booked',
    message: 'Your appointment has been booked.',
    appointmentId: 'appt-uuid-1',
    eventId: 'APPOINTMENT_BOOKED_appt-uuid-1',
    isRead: false,
    createdAt: new Date('2026-06-25T10:00:00Z'),
    ...overrides,
  } as Notification);

describe('NotificationService', () => {
  let service: NotificationService;
  let notifRepo: Record<string, jest.Mock>;
  let patientRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    notifRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      findAndCount: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      remove: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    patientRepo = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: getRepositoryToken(Notification), useValue: notifRepo },
        { provide: getRepositoryToken(PatientProfile), useValue: patientRepo },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
  });

  // ─── createNotification ───────────────────────────────────────────────────

  describe('createNotification', () => {
    it('should create and save a new notification when no duplicate exists', async () => {
      const dto = {
        patientId: 'patient-uuid-1',
        type: NotificationType.APPOINTMENT_BOOKED,
        title: 'Appointment Booked',
        message: 'Booked for 25 June at 10:00 AM.',
        appointmentId: 'appt-uuid-1',
        eventId: 'APPOINTMENT_BOOKED_appt-uuid-1',
      };
      const saved = makeNotif();
      notifRepo.findOne.mockResolvedValueOnce(null);
      notifRepo.create.mockReturnValue(saved);
      notifRepo.save.mockResolvedValue(saved);

      const result = await service.createNotification(dto);

      expect(notifRepo.findOne).toHaveBeenCalledWith({
        where: { eventId: dto.eventId },
      });
      expect(notifRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          patientId: dto.patientId,
          type: dto.type,
          isRead: false,
        }),
      );
      expect(notifRepo.save).toHaveBeenCalledWith(saved);
      expect(result).toEqual(saved);
    });

    it('should return existing notification when duplicate eventId is detected (pre-save check)', async () => {
      const existing = makeNotif();
      notifRepo.findOne.mockResolvedValueOnce(existing);

      const result = await service.createNotification({
        patientId: 'patient-uuid-1',
        type: NotificationType.APPOINTMENT_BOOKED,
        title: 'Appointment Booked',
        message: 'Duplicate.',
        eventId: 'APPOINTMENT_BOOKED_appt-uuid-1',
      });

      expect(notifRepo.save).not.toHaveBeenCalled();
      expect(result).toEqual(existing);
    });

    it('should skip eventId lookup when no eventId is provided', async () => {
      const saved = makeNotif({ eventId: undefined });
      notifRepo.create.mockReturnValue(saved);
      notifRepo.save.mockResolvedValue(saved);

      await service.createNotification({
        patientId: 'patient-uuid-1',
        type: NotificationType.APPOINTMENT_BOOKED,
        title: 'Appointment Booked',
        message: 'No eventId provided.',
      });

      expect(notifRepo.findOne).not.toHaveBeenCalled();
      expect(notifRepo.save).toHaveBeenCalled();
    });

    it('should handle SQLSTATE 23505 (unique constraint) and return the existing record', async () => {
      const existing = makeNotif();
      notifRepo.findOne
        .mockResolvedValueOnce(null) // Pre-save check returns nothing
        .mockResolvedValueOnce(existing); // Post-conflict fetch

      const saved = makeNotif();
      notifRepo.create.mockReturnValue(saved);

      const constraintError = { code: '23505' };
      notifRepo.save.mockRejectedValueOnce(constraintError);

      const result = await service.createNotification({
        patientId: 'patient-uuid-1',
        type: NotificationType.APPOINTMENT_BOOKED,
        title: 'Appointment Booked',
        message: 'Race condition duplicate.',
        eventId: 'APPOINTMENT_BOOKED_appt-uuid-1',
      });

      expect(result).toEqual(existing);
    });

    it('should re-throw non-23505 errors', async () => {
      notifRepo.findOne.mockResolvedValueOnce(null);
      notifRepo.create.mockReturnValue(makeNotif());
      notifRepo.save.mockRejectedValueOnce(new Error('DB_CONNECTION_LOST'));

      await expect(
        service.createNotification({
          patientId: 'patient-uuid-1',
          type: NotificationType.APPOINTMENT_BOOKED,
          title: 'Appointment Booked',
          message: 'Should re-throw.',
          eventId: 'APPOINTMENT_BOOKED_appt-uuid-1',
        }),
      ).rejects.toThrow('DB_CONNECTION_LOST');
    });

    it('should use provided EntityManager when supplied (transactional path)', async () => {
      const managerNotifRepo = {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockReturnValue(makeNotif()),
        save: jest.fn().mockResolvedValue(makeNotif()),
      };
      const mockManager = {
        getRepository: jest.fn().mockReturnValue(managerNotifRepo),
      };

      await service.createNotification(
        {
          patientId: 'patient-uuid-1',
          type: NotificationType.APPOINTMENT_BOOKED,
          title: 'Appointment Booked',
          message: 'Transactional path.',
          eventId: 'APPOINTMENT_BOOKED_appt-uuid-1',
        },
        mockManager as any,
      );

      expect(mockManager.getRepository).toHaveBeenCalledWith(Notification);
      expect(managerNotifRepo.save).toHaveBeenCalled();
      // Should NOT use the injected notificationRepo
      expect(notifRepo.save).not.toHaveBeenCalled();
    });
  });

  // ─── getPatientNotifications ──────────────────────────────────────────────

  describe('getPatientNotifications', () => {
    it('should return notifications ordered by createdAt DESC for valid patient, along with counts', async () => {
      const patient = { id: 'patient-uuid-1' } as PatientProfile;
      const notifications = [
        makeNotif({ id: 'notif-2', createdAt: new Date('2026-06-26T10:00:00Z'), isRead: false }),
        makeNotif({ id: 'notif-1', createdAt: new Date('2026-06-25T10:00:00Z'), isRead: true }),
      ];
      patientRepo.findOne.mockResolvedValue(patient);
      notifRepo.findAndCount.mockResolvedValue([notifications, 2]);

      const result = await service.getPatientNotifications('user-uuid-1');

      expect(patientRepo.findOne).toHaveBeenCalledWith({
        where: { user: { id: 'user-uuid-1' } },
      });
      expect(notifRepo.findAndCount).toHaveBeenCalledWith({
        where: { patientId: 'patient-uuid-1' },
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual({
        data: notifications,
        totalCount: 2,
        unreadCount: 1,
      });
    });

    it('should throw NotFoundException if patient profile does not exist', async () => {
      patientRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getPatientNotifications('nonexistent-user'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return empty array and 0 counts when patient has no notifications', async () => {
      patientRepo.findOne.mockResolvedValue({ id: 'patient-uuid-1' });
      notifRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.getPatientNotifications('user-uuid-1');
      expect(result).toEqual({ data: [], totalCount: 0, unreadCount: 0 });
    });
  });

  // ─── markAsRead ───────────────────────────────────────────────────────────

  describe('markAsRead', () => {
    it('should mark notification as read for the correct patient', async () => {
      const patient = { id: 'patient-uuid-1' } as PatientProfile;
      const notification = makeNotif({ isRead: false });
      const saved = makeNotif({ isRead: true });

      patientRepo.findOne.mockResolvedValue(patient);
      notifRepo.findOne.mockResolvedValue(notification);
      notifRepo.save.mockResolvedValue(saved);

      const result = await service.markAsRead('notif-uuid-1', 'user-uuid-1');

      expect(notification.isRead).toBe(true);
      expect(notifRepo.save).toHaveBeenCalledWith(notification);
      expect(result).toEqual(saved);
    });

    it('should throw NotFoundException if patient profile does not exist', async () => {
      patientRepo.findOne.mockResolvedValue(null);

      await expect(
        service.markAsRead('notif-uuid-1', 'nonexistent-user'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if notification does not exist', async () => {
      patientRepo.findOne.mockResolvedValue({ id: 'patient-uuid-1' });
      notifRepo.findOne.mockResolvedValue(null);

      await expect(
        service.markAsRead('nonexistent-notif', 'user-uuid-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException (IDOR) if notification belongs to different patient', async () => {
      patientRepo.findOne.mockResolvedValue({ id: 'patient-uuid-ATTACKER' });
      notifRepo.findOne.mockResolvedValue(
        makeNotif({ patientId: 'patient-uuid-VICTIM' }),
      );

      await expect(
        service.markAsRead('notif-uuid-1', 'attacker-user-uuid'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException with descriptive message on IDOR attempt', async () => {
      patientRepo.findOne.mockResolvedValue({ id: 'patient-uuid-ATTACKER' });
      notifRepo.findOne.mockResolvedValue(
        makeNotif({ patientId: 'patient-uuid-VICTIM' }),
      );

      await expect(
        service.markAsRead('notif-uuid-1', 'attacker-user-uuid'),
      ).rejects.toThrow('not authorized');
    });

    it('should be idempotent when marking an already-read notification as read', async () => {
      const patient = { id: 'patient-uuid-1' } as PatientProfile;
      const notification = makeNotif({ isRead: true }); // already read
      const saved = makeNotif({ isRead: true });

      patientRepo.findOne.mockResolvedValue(patient);
      notifRepo.findOne.mockResolvedValue(notification);
      notifRepo.save.mockResolvedValue(saved);

      const result = await service.markAsRead('notif-uuid-1', 'user-uuid-1');

      // Should still succeed (idempotent) — isRead stays true
      expect(notification.isRead).toBe(true);
      expect(notifRepo.save).toHaveBeenCalled();
      expect(result.isRead).toBe(true);
    });
  });

  // ─── markAllAsRead ────────────────────────────────────────────────────────

  describe('markAllAsRead', () => {
    it('should mark all unread notifications as read for a patient', async () => {
      patientRepo.findOne.mockResolvedValue({ id: 'patient-uuid-1' });
      notifRepo.update.mockResolvedValue({ affected: 3 });

      const result = await service.markAllAsRead('user-uuid-1');

      expect(notifRepo.update).toHaveBeenCalledWith(
        { patientId: 'patient-uuid-1', isRead: false },
        { isRead: true },
      );
      expect(result).toEqual({ updatedCount: 3 });
    });
  });

  // ─── deleteNotification ───────────────────────────────────────────────────

  describe('deleteNotification', () => {
    it('should delete a specific notification', async () => {
      const patient = { id: 'patient-uuid-1' } as PatientProfile;
      const notification = makeNotif();
      patientRepo.findOne.mockResolvedValue(patient);
      notifRepo.findOne.mockResolvedValue(notification);

      await service.deleteNotification('notif-uuid-1', 'user-uuid-1');

      expect(notifRepo.remove).toHaveBeenCalledWith(notification);
    });

    it('should throw ForbiddenException if deleting another patient\'s notification', async () => {
      patientRepo.findOne.mockResolvedValue({ id: 'patient-uuid-ATTACKER' });
      notifRepo.findOne.mockResolvedValue(makeNotif({ patientId: 'patient-uuid-VICTIM' }));

      await expect(
        service.deleteNotification('notif-uuid-1', 'user-uuid-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── deleteAllNotifications ───────────────────────────────────────────────

  describe('deleteAllNotifications', () => {
    it('should delete all notifications for a patient', async () => {
      patientRepo.findOne.mockResolvedValue({ id: 'patient-uuid-1' });
      notifRepo.delete.mockResolvedValue({ affected: 5 });

      const result = await service.deleteAllNotifications('user-uuid-1');

      expect(notifRepo.delete).toHaveBeenCalledWith({ patientId: 'patient-uuid-1' });
      expect(result).toEqual({ deletedCount: 5 });
    });
  });

  // ─── Event-specific notification type tests ───────────────────────────────

  describe('Notification type coverage', () => {
    const allTypes = [
      NotificationType.APPOINTMENT_BOOKED,
      NotificationType.APPOINTMENT_CANCELLED,
      NotificationType.APPOINTMENT_RESCHEDULED,
    ];

    allTypes.forEach((type) => {
      it(`should create a notification of type ${type} and save it`, async () => {
        const saved = makeNotif({ type, eventId: `${type}_appt-uuid-1` });
        notifRepo.findOne.mockResolvedValue(null);
        notifRepo.create.mockReturnValue(saved);
        notifRepo.save.mockResolvedValue(saved);

        const result = await service.createNotification({
          patientId: 'patient-uuid-1',
          type,
          title: `Title for ${type}`,
          message: `Message for ${type}`,
          appointmentId: 'appt-uuid-1',
          eventId: `${type}_appt-uuid-1`,
        });

        expect(result.type).toBe(type);
        expect(notifRepo.save).toHaveBeenCalled();
      });
    });
  });

  // ─── Enum coverage ────────────────────────────────────────────────────────

  describe('NotificationType enum', () => {
    it('should contain all three required event types', () => {
      expect(NotificationType.APPOINTMENT_BOOKED).toBe('APPOINTMENT_BOOKED');
      expect(NotificationType.APPOINTMENT_CANCELLED).toBe('APPOINTMENT_CANCELLED');
      expect(NotificationType.APPOINTMENT_RESCHEDULED).toBe('APPOINTMENT_RESCHEDULED');
    });
  });
});
