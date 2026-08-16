import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
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
  skippedBreakdown?: {
    incompleteData: number;
    outsideWindow: number;
  };
}

export const CRON_REMINDER_ADVISORY_LOCK_ID = 1785100000001;

@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);

  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,
    private readonly notificationService: NotificationService,
    @Optional() private readonly dataSource?: DataSource,
  ) {}

  /**
   * Cron job executing periodically to check for upcoming appointments requiring reminders.
   * Default schedule: Every minute.
   * Uses PostgreSQL transaction-level advisory locks to prevent duplicate cron executions across multi-instance clusters.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleCronReminders(): Promise<void> {
    try {
      // In clustered deployments, coordinate execution using PostgreSQL advisory lock
      if (this.dataSource && this.dataSource.isInitialized) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
          const lockResult = (await queryRunner.query(
            `SELECT pg_try_advisory_xact_lock(${CRON_REMINDER_ADVISORY_LOCK_ID}) as acquired;`,
          )) as Array<{ acquired?: boolean }>;
          const acquired = lockResult?.[0]?.acquired ?? true;

          if (!acquired) {
            this.logger.debug(
              '[Cron-Reminder] Cycle active on another cluster pod. Skipping duplicate execution.',
            );
            await queryRunner.rollbackTransaction();
            await queryRunner.release();
            return;
          }

          const stats = await this.processAppointmentReminders();
          await queryRunner.commitTransaction();
          await queryRunner.release();

          if (stats.created > 0) {
            this.logger.log(
              `[Cron-Reminder] Execution complete: ${stats.created} reminders created, ${stats.duplicates} duplicates skipped out of ${stats.processed} processed appointments. (Skipped Breakdown: ${JSON.stringify(stats.skippedBreakdown)})`,
            );
          }
          return;
        } catch {
          await queryRunner.rollbackTransaction().catch(() => {});
          await queryRunner.release().catch(() => {});
        }
      }

      // Fallback for environments where advisory lock is unsupported
      const stats = await this.processAppointmentReminders();
      if (stats.created > 0) {
        this.logger.log(
          `[Cron-Reminder] Execution complete: ${stats.created} reminders created, ${stats.duplicates} duplicates skipped out of ${stats.processed} processed appointments. (Skipped Breakdown: ${JSON.stringify(stats.skippedBreakdown)})`,
        );
      }
    } catch (err) {
      this.logger.error(
        '[Cron-Reminder] Failed to execute cron appointment reminders',
        err,
      );
    }
  }

  /**
   * Core idempotent reminder processing logic.
   * Scans active CONFIRMED appointments within the configured reminder window,
   * constructs STREAM or WAVE reminder messages, and persists deduplicated notifications.
   */
  async processAppointmentReminders(
    targetAppointmentId?: string,
  ): Promise<ReminderProcessingStats> {
    const reminderWindowMinutes = process.env.REMINDER_WINDOW_MINUTES
      ? parseInt(process.env.REMINDER_WINDOW_MINUTES, 10)
      : 2880; // Default 48-hour reminder window (covers today & tomorrow)

    const nowTs = Date.now();
    const now = new Date(nowTs);
    const todayUtcDateStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
    const windowEndTs = nowTs + reminderWindowMinutes * 60 * 1000;

    // Query active CONFIRMED appointments (or specific target appointment)
    const appointments = await this.appointmentRepo.find({
      where: targetAppointmentId
        ? { id: targetAppointmentId, status: AppointmentStatus.CONFIRMED }
        : { status: AppointmentStatus.CONFIRMED },
      relations: { doctor: true, patient: true },
    });

    const stats: ReminderProcessingStats = {
      processed: 0,
      created: 0,
      duplicates: 0,
      skipped: 0,
      skippedBreakdown: {
        incompleteData: 0,
        outsideWindow: 0,
      },
    };

    for (const appointment of appointments) {
      stats.processed++;

      // Exclude invalid/incomplete appointments
      if (!appointment.patientId || !appointment.doctor) {
        stats.skipped++;
        stats.skippedBreakdown!.incompleteData++;
        continue;
      }

      // Determine appointment Date/Time object for window check
      const startTimeStr =
        appointment.slotStartTime ||
        (appointment.window ? appointment.window.split('-')[0]?.trim() : null);

      if (!startTimeStr) {
        stats.skipped++;
        stats.skippedBreakdown!.incompleteData++;
        continue;
      }

      const appointmentDateTime = this.parseAppointmentDateTime(
        appointment.date,
        startTimeStr,
      );

      if (!appointmentDateTime) {
        stats.skipped++;
        stats.skippedBreakdown!.incompleteData++;
        continue;
      }

      const appointmentTs = appointmentDateTime.getTime();
      const minCutoffTs = nowTs - 60 * 60 * 1000;

      // Must be upcoming and within [now - 1 hour, windowEnd] in UTC epoch milliseconds
      if (appointmentTs < minCutoffTs || appointmentTs > windowEndTs) {
        stats.skipped++;
        stats.skippedBreakdown!.outsideWindow++;
        continue;
      }

      const rawDoctorName = appointment.doctor.fullName || 'your doctor';
      const formattedDoctorName =
        rawDoctorName.startsWith('Dr.') || rawDoctorName.startsWith('Dr ')
          ? rawDoctorName
          : `Dr. ${rawDoctorName}`;

      const eventId = `reminder_${appointment.id}`;

      const isRescheduled = Boolean(appointment.isAutoRescheduled);
      const title = isRescheduled
        ? 'Appointment Reminder (Updated Schedule)'
        : 'Appointment Reminder';
      let message = '';

      if (
        appointment.scheduleType === SchedulingType.STREAM ||
        appointment.slotStartTime
      ) {
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
        const isToday = appointment.date === todayUtcDateStr;
        const dateDescriptor = isToday ? 'today' : `on ${appointment.date}`;
        message = `Reminder: You have an appointment with ${formattedDoctorName} ${dateDescriptor}. Reporting Time: ${windowStart}. Token Number: ${appointment.token}`;
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

  /**
   * Deterministically parses YYYY-MM-DD and HH:MM or HH:MM:SS into UTC Date object,
   * eliminating host machine timezone dependencies across multi-region servers.
   */
  private parseAppointmentDateTime(
    dateStr: string,
    timeStr: string,
  ): Date | null {
    try {
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
      return new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));
    } catch {
      return null;
    }
  }
}
