import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Appointment } from '../scheduling/entities/appointment.entity';
import { AppointmentStatus } from '../scheduling/enums/appointment-status.enum';
import { SchedulingType } from '../scheduling/enums/scheduling-type.enum';
import { NotificationService } from './notification.service';
import { NotificationType } from './enums/notification-type.enum';
import { Notification } from './entities/notification.entity';

export interface ReminderProcessingStats {
  processed: number;
  created: number;
  duplicates: number;
  skipped: number;
}

@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);

  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Cron job executing periodically to check for upcoming appointments requiring reminders.
   * Default schedule: Every minute.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleCronReminders(): Promise<void> {
    try {
      const stats = await this.processAppointmentReminders();
      if (stats.created > 0) {
        this.logger.log(
          `Cron reminder execution complete: ${stats.created} reminders created, ${stats.duplicates} duplicates skipped out of ${stats.processed} processed appointments.`,
        );
      }
    } catch (err) {
      this.logger.error('Failed to execute cron appointment reminders', err);
    }
  }

  /**
   * Core idempotent reminder processing logic.
   * Scans active CONFIRMED appointments within the configured reminder window,
   * constructs STREAM or WAVE reminder messages, and persists deduplicated notifications.
   */
  async processAppointmentReminders(): Promise<ReminderProcessingStats> {
    const reminderWindowMinutes = process.env.REMINDER_WINDOW_MINUTES
      ? parseInt(process.env.REMINDER_WINDOW_MINUTES, 10)
      : 2880; // Default 48-hour reminder window (covers today & tomorrow)

    const now = new Date();
    const windowEnd = new Date(
      now.getTime() + reminderWindowMinutes * 60 * 1000,
    );

    // Query active CONFIRMED appointments
    const appointments = await this.appointmentRepo.find({
      where: { status: AppointmentStatus.CONFIRMED },
      relations: { doctor: true, patient: true },
    });

    const stats: ReminderProcessingStats = {
      processed: 0,
      created: 0,
      duplicates: 0,
      skipped: 0,
    };

    for (const appointment of appointments) {
      stats.processed++;

      // Exclude invalid/incomplete appointments
      if (!appointment.patientId || !appointment.doctor) {
        stats.skipped++;
        continue;
      }

      // Determine appointment Date/Time object for window check
      const startTimeStr =
        appointment.slotStartTime ||
        (appointment.window ? appointment.window.split('-')[0]?.trim() : null);

      if (!startTimeStr) {
        stats.skipped++;
        continue;
      }

      const appointmentDateTime = this.parseAppointmentDateTime(
        appointment.date,
        startTimeStr,
      );

      if (!appointmentDateTime) {
        stats.skipped++;
        continue;
      }

      // Must be upcoming and within [now - 1 hour, windowEnd]
      const minCutoff = new Date(now.getTime() - 60 * 60 * 1000);
      if (appointmentDateTime < minCutoff || appointmentDateTime > windowEnd) {
        stats.skipped++;
        continue;
      }

      const rawDoctorName = appointment.doctor.fullName || 'your doctor';
      const formattedDoctorName =
        rawDoctorName.startsWith('Dr.') || rawDoctorName.startsWith('Dr ')
          ? rawDoctorName
          : `Dr. ${rawDoctorName}`;

      const eventId = `reminder_${appointment.id}`;

      let title = 'Appointment Reminder';
      let message = '';

      if (
        appointment.scheduleType === SchedulingType.STREAM ||
        appointment.slotStartTime
      ) {
        title = 'Appointment Reminder';
        message = `Reminder: You have an appointment with ${formattedDoctorName} on ${appointment.date} at ${appointment.slotStartTime}.`;
      } else if (
        appointment.scheduleType === SchedulingType.WAVE ||
        appointment.window
      ) {
        if (!appointment.token || !appointment.window) {
          stats.skipped++;
          continue; // Missing required WAVE token or window
        }
        const windowStart = appointment.window.split('-')[0]?.trim() || '';
        title = 'Appointment Reminder';
        message = `Reminder: You have an appointment with ${formattedDoctorName} today. Reporting Time: ${windowStart}. Token Number: ${appointment.token}`;
      } else {
        stats.skipped++;
        continue;
      }

      try {
        const created = await this.notificationService.createNotification({
          patientId: appointment.patientId,
          type: NotificationType.APPOINTMENT_REMINDER,
          title,
          message,
          appointmentId: appointment.id,
          eventId,
        });

        // Check if created just now vs existing duplicate
        if ((created as Notification & { isExisting?: boolean }).isExisting) {
          stats.duplicates++;
        } else {
          stats.created++;
        }
      } catch (err: unknown) {
        // Safe idempotent handling of duplicate eventId (SQLSTATE 23505)
        if (
          typeof err === 'object' &&
          err !== null &&
          'code' in err &&
          (err as { code: string }).code === '23505'
        ) {
          stats.duplicates++;
        } else {
          this.logger.warn(
            `Failed to create reminder for appointment ${appointment.id}: ${(err as Error).message}`,
          );
          stats.skipped++;
        }
      }
    }

    return stats;
  }

  private parseAppointmentDateTime(
    dateStr: string,
    timeStr: string,
  ): Date | null {
    try {
      // Handles YYYY-MM-DD and HH:MM or HH:MM:SS
      const [year, month, day] = dateStr.split('-').map(Number);
      const [hours, minutes] = timeStr.split(':').map(Number);
      if (
        !year ||
        !month ||
        !day ||
        hours === undefined ||
        minutes === undefined
      ) {
        return null;
      }
      return new Date(year, month - 1, day, hours, minutes, 0);
    } catch {
      return null;
    }
  }
}
