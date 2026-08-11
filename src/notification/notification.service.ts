import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { CreateNotificationDto } from './dto/notification.dto';
import { PatientProfile } from '../patient/entities/patient-profile.entity';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(PatientProfile)
    private readonly patientProfileRepo: Repository<PatientProfile>,
  ) {}

  /**
   * Create notification automatically for an appointment event.
   * Prevents duplicates by checking eventId or catching SQLSTATE 23505 unique constraint violation.
   */
  async createNotification(
    dto: CreateNotificationDto,
    manager?: EntityManager,
  ): Promise<Notification> {
    const repo = manager ? manager.getRepository(Notification) : this.notificationRepo;

    if (dto.eventId) {
      const existing = await repo.findOne({ where: { eventId: dto.eventId } });
      if (existing) {
        return existing;
      }
    }

    try {
      const notification = repo.create({
        patientId: dto.patientId,
        type: dto.type,
        title: dto.title,
        message: dto.message,
        appointmentId: dto.appointmentId,
        eventId: dto.eventId,
        isRead: false,
      });
      return await repo.save(notification);
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code: string }).code === '23505' &&
        dto.eventId
      ) {
        const existing = await repo.findOne({ where: { eventId: dto.eventId } });
        if (existing) {
          return existing;
        }
      }
      throw err;
    }
  }

  /**
   * Retrieve all notifications for the authenticated patient, ordered latest first (createdAt DESC).
   */
  async getPatientNotifications(userId: string): Promise<Notification[]> {
    const patient = await this.patientProfileRepo.findOne({ where: { user: { id: userId } } });
    if (!patient) {
      throw new NotFoundException('Patient profile not found');
    }

    return this.notificationRepo.find({
      where: { patientId: patient.id },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Mark a specific notification as read.
   */
  async markAsRead(notificationId: string, userId: string): Promise<Notification> {
    const patient = await this.patientProfileRepo.findOne({ where: { user: { id: userId } } });
    if (!patient) {
      throw new NotFoundException('Patient profile not found');
    }

    const notification = await this.notificationRepo.findOne({ where: { id: notificationId } });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.patientId !== patient.id) {
      throw new ForbiddenException('You are not authorized to modify this notification');
    }

    notification.isRead = true;
    return this.notificationRepo.save(notification);
  }
}
