import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { RecurringAvailability } from './entities/recurring-availability.entity';
import { CustomAvailability } from './entities/custom-availability.entity';
import { DoctorProfile } from './entities/doctor-profile.entity';
import { Appointment } from '../scheduling/entities/appointment.entity';
import { SchedulingConfig } from '../scheduling/entities/scheduling-config.entity';
import { Weekday } from './enums/weekday.enum';
import { CreateRecurringAvailabilityDto } from './dto/create-recurring-availability.dto';
import { UpdateRecurringAvailabilityDto } from './dto/update-recurring-availability.dto';
import { CreateCustomAvailabilityDto } from './dto/create-custom-availability.dto';
import { SchedulingType } from '../scheduling/enums/scheduling-type.enum';
import { AppointmentStatus } from '../scheduling/enums/appointment-status.enum';

const WEEKDAY_NAMES: Weekday[] = [
  Weekday.Sunday,
  Weekday.Monday,
  Weekday.Tuesday,
  Weekday.Wednesday,
  Weekday.Thursday,
  Weekday.Friday,
  Weekday.Saturday,
];

@Injectable()
export class DoctorAvailabilityService {
  constructor(
    @InjectRepository(RecurringAvailability)
    private readonly recurringRepo: Repository<RecurringAvailability>,
    @InjectRepository(CustomAvailability)
    private readonly customRepo: Repository<CustomAvailability>,
    @InjectRepository(DoctorProfile)
    private readonly doctorProfileRepo: Repository<DoctorProfile>,
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,
    @InjectRepository(SchedulingConfig)
    private readonly configRepo: Repository<SchedulingConfig>,
    private readonly dataSource: DataSource,
  ) {}

  // ─── Private Helpers ────────────────────────────────────────────────────────

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private minutesToTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }

  private validateTimeRange(startTime: string, endTime: string): void {
    if (this.timeToMinutes(startTime) >= this.timeToMinutes(endTime)) {
      throw new BadRequestException('startTime must be before endTime');
    }
  }

  private checkOverlap(
    existingSlots: { startTime: string; endTime: string }[],
    newStart: number,
    newEnd: number,
  ): void {
    for (const slot of existingSlots) {
      const existingStart = this.timeToMinutes(slot.startTime);
      const existingEnd = this.timeToMinutes(slot.endTime);
      if (newStart < existingEnd && existingStart < newEnd) {
        throw new ConflictException('Time slot overlaps with an existing availability');
      }
    }
  }

  private validateDate(date: string): void {
    const [yearStr, monthStr, dayStr] = date.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const day = parseInt(dayStr, 10);

    const parsed = new Date(year, month - 1, day);
    const reconstructed = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;

    if (reconstructed !== date) {
      throw new BadRequestException(`${date} is not a valid calendar date`);
    }
  }

  private async resolveDoctorProfile(userId: string): Promise<DoctorProfile> {
    const profile = await this.doctorProfileRepo.findOne({
      where: [{ id: userId }, { user: { id: userId } }],
      relations: { user: true },
    });
    if (!profile) {
      throw new NotFoundException('Doctor profile not found');
    }
    return profile;
  }

  private getWeekdayForDateStr(dateStr: string): Weekday {
    const [yearStr, monthStr, dayStr] = dateStr.split('-');
    const parsed = new Date(
      parseInt(yearStr, 10),
      parseInt(monthStr, 10) - 1,
      parseInt(dayStr, 10),
    );
    return WEEKDAY_NAMES[parsed.getDay()];
  }

  // ─── Elastic Shrink Auto-Rescheduling Core ─────────────────────────────────

  private async handleElasticShrinkAutoReschedule(
    queryRunner: QueryRunner,
    doctorId: string,
  ): Promise<{ count: number; details: Record<string, unknown>[] }> {
    const todayStr = new Date().toISOString().split('T')[0];

    const activeFutureAppointments = await queryRunner.manager.find(Appointment, {
      where: {
        doctorId,
        status: AppointmentStatus.CONFIRMED,
      },
      lock: { mode: 'pessimistic_write' },
    });

    const config = await queryRunner.manager.findOne(SchedulingConfig, {
      where: { doctorId },
    });

    const activeRecurring = await queryRunner.manager.find(RecurringAvailability, {
      where: { doctor: { id: doctorId } },
    });

    const activeOverrides = await queryRunner.manager.find(CustomAvailability, {
      where: { doctor: { id: doctorId } },
    });

    const affectedDetails: Record<string, unknown>[] = [];

    for (const app of activeFutureAppointments) {
      if (app.date < todayStr) {
        continue;
      }

      const overridesForDate = activeOverrides.filter((o) => o.date === app.date);
      let isCovered = false;

      if (overridesForDate.length > 0) {
        if (app.scheduleType === SchedulingType.STREAM && app.slotStartTime && app.slotEndTime) {
          const appStart = this.timeToMinutes(app.slotStartTime);
          const appEnd = this.timeToMinutes(app.slotEndTime);
          isCovered = overridesForDate.some(
            (o) =>
              this.timeToMinutes(o.startTime) <= appStart &&
              appEnd <= this.timeToMinutes(o.endTime),
          );
        } else if (app.scheduleType === SchedulingType.WAVE && app.window) {
          const [wStartStr, wEndStr] = app.window.split('-');
          const appStart = this.timeToMinutes(wStartStr);
          const appEnd = this.timeToMinutes(wEndStr);
          isCovered = overridesForDate.some(
            (o) =>
              this.timeToMinutes(o.startTime) <= appStart &&
              appEnd <= this.timeToMinutes(o.endTime),
          );
        }
      } else {
        const weekday = this.getWeekdayForDateStr(app.date);
        const recurringForDay = activeRecurring.filter((r) => r.weekday === weekday);

        if (recurringForDay.length > 0) {
          if (app.scheduleType === SchedulingType.STREAM && app.slotStartTime && app.slotEndTime) {
            const appStart = this.timeToMinutes(app.slotStartTime);
            const appEnd = this.timeToMinutes(app.slotEndTime);
            isCovered = recurringForDay.some(
              (r) =>
                this.timeToMinutes(r.startTime) <= appStart &&
                appEnd <= this.timeToMinutes(r.endTime),
            );
          } else if (app.scheduleType === SchedulingType.WAVE && app.window) {
            const [wStartStr, wEndStr] = app.window.split('-');
            const appStart = this.timeToMinutes(wStartStr.trim());
            const appEnd = this.timeToMinutes(wEndStr.trim());
            isCovered = recurringForDay.some(
              (r) =>
                this.timeToMinutes(r.startTime) <= appStart &&
                appEnd <= this.timeToMinutes(r.endTime),
            );
          }
        }
      }

      if (!isCovered) {
        // Save audit metadata
        const origDate = app.date;
        const origSlotStart = app.slotStartTime;
        const origSlotEnd = app.slotEndTime;
        const origWindow = app.window;
        const origToken = app.token;

        app.previousDate = origDate;
        app.previousSlotStartTime = origSlotStart;
        app.previousSlotEndTime = origSlotEnd;
        app.previousWindow = origWindow;
        app.previousToken = origToken;
        app.isAutoRescheduled = true;
        app.rescheduledReason = 'ELASTIC_AVAILABILITY_SHRINK';

        let autoRescheduled = false;
        const startDateObj = new Date(`${origDate}T00:00:00Z`);

        // Search next 30 days for a valid slot/window
        for (let offset = 1; offset <= 30; offset++) {
          const nextDateObj = new Date(startDateObj);
          nextDateObj.setUTCDate(nextDateObj.getUTCDate() + offset);
          const nextDateStr = nextDateObj.toISOString().split('T')[0];

          const dayOverrides = activeOverrides.filter((o) => o.date === nextDateStr);
          let windowsForNextDate: { startTime: string; endTime: string }[] = [];

          if (dayOverrides.length > 0) {
            windowsForNextDate = dayOverrides.map((o) => ({
              startTime: o.startTime,
              endTime: o.endTime,
            }));
          } else {
            const nextWeekday = this.getWeekdayForDateStr(nextDateStr);
            const dayRecurring = activeRecurring.filter((r) => r.weekday === nextWeekday);
            windowsForNextDate = dayRecurring.map((r) => ({
              startTime: r.startTime,
              endTime: r.endTime,
            }));
          }

          if (windowsForNextDate.length === 0) {
            continue;
          }

          if (app.scheduleType === SchedulingType.STREAM) {
            const slotDuration = config?.slotDuration || 15;
            const bufferTime = config?.bufferTime || 0;

            const existingBookings = await queryRunner.manager.find(Appointment, {
              where: {
                doctorId,
                date: nextDateStr,
                status: AppointmentStatus.CONFIRMED,
              },
            });

            let foundSlot: { startTime: string; endTime: string } | null = null;

            for (const win of windowsForNextDate) {
              const startMin = this.timeToMinutes(win.startTime);
              const endMin = this.timeToMinutes(win.endTime);
              let curr = startMin;

              while (curr + slotDuration <= endMin) {
                const sStartStr = this.minutesToTime(curr);
                const sEndStr = this.minutesToTime(curr + slotDuration);

                const isBooked = existingBookings.some((b) => {
                  if (!b.slotStartTime || !b.slotEndTime) return false;
                  const bStart = this.timeToMinutes(b.slotStartTime);
                  const bEnd = this.timeToMinutes(b.slotEndTime);
                  return curr < bEnd && bStart < curr + slotDuration;
                });

                if (!isBooked) {
                  foundSlot = { startTime: sStartStr, endTime: sEndStr };
                  break;
                }

                curr += slotDuration + bufferTime;
              }

              if (foundSlot) break;
            }

            if (foundSlot) {
              app.date = nextDateStr;
              app.slotStartTime = foundSlot.startTime;
              app.slotEndTime = foundSlot.endTime;
              app.window = null as any;
              app.token = null as any;
              autoRescheduled = true;
              break;
            }
          } else if (app.scheduleType === SchedulingType.WAVE) {
            const maxCapacity = config?.maxCapacity || 5;

            let foundWindow: string | null = null;
            let assignedToken: number | null = null;

            for (const win of windowsForNextDate) {
              const windowStr = `${win.startTime.slice(0, 5)}-${win.endTime.slice(0, 5)}`;

              const waveBookings = await queryRunner.manager.find(Appointment, {
                where: {
                  doctorId,
                  date: nextDateStr,
                  window: windowStr,
                  status: AppointmentStatus.CONFIRMED,
                },
              });

              if (waveBookings.length < maxCapacity) {
                const activeTokens = new Set(
                  waveBookings.map((b) => b.token).filter((t): t is number => t !== null && t !== undefined),
                );
                let t = 1;
                while (activeTokens.has(t)) t++;

                if (t <= maxCapacity) {
                  foundWindow = windowStr;
                  assignedToken = t;
                  break;
                }
              }
            }

            if (foundWindow && assignedToken !== null) {
              app.date = nextDateStr;
              app.window = foundWindow;
              app.token = assignedToken;
              app.slotStartTime = null as any;
              app.slotEndTime = null as any;
              autoRescheduled = true;
              break;
            }
          }
        }

        if (!autoRescheduled) {
          throw new BadRequestException(
            `Cannot shrink availability: affected appointment ${app.id} on date ${origDate} could not be automatically rescheduled to any future available slot`,
          );
        }

        const savedApp = await queryRunner.manager.save(Appointment, app);
        affectedDetails.push({
          appointmentId: savedApp.id,
          patientId: savedApp.patientId,
          previousDate: origDate,
          newDate: savedApp.date,
          scheduleType: savedApp.scheduleType,
          slot: savedApp.slotStartTime && savedApp.slotEndTime ? { startTime: savedApp.slotStartTime, endTime: savedApp.slotEndTime } : null,
          window: savedApp.window ?? null,
          token: savedApp.token ?? null,
          rescheduledReason: savedApp.rescheduledReason,
        });
      }
    }

    return {
      count: affectedDetails.length,
      details: affectedDetails,
    };
  }

  // ─── Recurring Availability Endpoints ─────────────────────────────────────

  async createRecurring(
    userId: string,
    dto: CreateRecurringAvailabilityDto,
  ): Promise<RecurringAvailability> {
    this.validateTimeRange(dto.startTime, dto.endTime);
    const doctor = await this.resolveDoctorProfile(userId);

    const existing = await this.recurringRepo.find({
      where: { doctor: { id: doctor.id }, weekday: dto.weekday },
    });

    this.checkOverlap(existing, this.timeToMinutes(dto.startTime), this.timeToMinutes(dto.endTime));

    const slot = this.recurringRepo.create({
      doctor,
      weekday: dto.weekday,
      startTime: dto.startTime,
      endTime: dto.endTime,
    });

    return this.recurringRepo.save(slot);
  }

  async getRecurring(userId: string): Promise<RecurringAvailability[]> {
    const doctor = await this.resolveDoctorProfile(userId);
    return this.recurringRepo.find({
      where: { doctor: { id: doctor.id } },
      order: { weekday: 'ASC', startTime: 'ASC' },
    });
  }

  async updateRecurring(
    userId: string,
    id: string,
    dto: UpdateRecurringAvailabilityDto,
  ): Promise<Record<string, unknown>> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const doctor = await this.resolveDoctorProfile(userId);

      const slot = await queryRunner.manager.findOne(RecurringAvailability, {
        where: { id },
        relations: { doctor: true },
      });
      if (!slot) {
        throw new NotFoundException('Recurring availability not found');
      }
      if (slot.doctor.id !== doctor.id) {
        throw new ForbiddenException('You are not allowed to update this availability');
      }

      const updatedStartTime = dto.startTime ?? slot.startTime;
      const updatedEndTime = dto.endTime ?? slot.endTime;
      const updatedWeekday = dto.weekday ?? slot.weekday;

      this.validateTimeRange(updatedStartTime, updatedEndTime);

      const existing = await queryRunner.manager.find(RecurringAvailability, {
        where: { doctor: { id: doctor.id }, weekday: updatedWeekday },
      });
      const otherSlots = existing.filter((s) => s.id !== slot.id);

      this.checkOverlap(
        otherSlots,
        this.timeToMinutes(updatedStartTime),
        this.timeToMinutes(updatedEndTime),
      );

      Object.assign(slot, {
        weekday: updatedWeekday,
        startTime: updatedStartTime,
        endTime: updatedEndTime,
      });

      const savedSlot = await queryRunner.manager.save(RecurringAvailability, slot);

      const autoRescheduleSummary = await this.handleElasticShrinkAutoReschedule(
        queryRunner,
        doctor.id,
      );

      await queryRunner.commitTransaction();

      return {
        id: savedSlot.id,
        weekday: savedSlot.weekday,
        startTime: savedSlot.startTime,
        endTime: savedSlot.endTime,
        autoRescheduledAppointmentsCount: autoRescheduleSummary.count,
        autoRescheduledAppointments: autoRescheduleSummary.details,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async deleteRecurring(userId: string, id: string): Promise<Record<string, unknown>> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const doctor = await this.resolveDoctorProfile(userId);

      const slot = await queryRunner.manager.findOne(RecurringAvailability, {
        where: { id },
        relations: { doctor: true },
      });
      if (!slot) {
        throw new NotFoundException('Recurring availability not found');
      }
      if (slot.doctor.id !== doctor.id) {
        throw new ForbiddenException('You are not allowed to delete this availability');
      }

      await queryRunner.manager.remove(RecurringAvailability, slot);

      const autoRescheduleSummary = await this.handleElasticShrinkAutoReschedule(
        queryRunner,
        doctor.id,
      );

      await queryRunner.commitTransaction();

      return {
        message: 'Recurring availability deleted successfully',
        deletedId: id,
        autoRescheduledAppointmentsCount: autoRescheduleSummary.count,
        autoRescheduledAppointments: autoRescheduleSummary.details,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ─── Custom Availability ─────────────────────────────────────────────────────

  async createOverride(
    userId: string,
    dto: CreateCustomAvailabilityDto,
  ): Promise<CustomAvailability> {
    this.validateDate(dto.date);
    this.validateTimeRange(dto.startTime, dto.endTime);

    const doctor = await this.resolveDoctorProfile(userId);

    const existing = await this.customRepo.find({
      where: { doctor: { id: doctor.id }, date: dto.date },
    });

    this.checkOverlap(existing, this.timeToMinutes(dto.startTime), this.timeToMinutes(dto.endTime));

    const slot = this.customRepo.create({
      doctor,
      date: dto.date,
      startTime: dto.startTime,
      endTime: dto.endTime,
    });

    return this.customRepo.save(slot);
  }

  async getByDate(
    userId: string,
    date: string,
  ): Promise<{ source: string; slots: RecurringAvailability[] | CustomAvailability[] }> {
    if (!date) {
      throw new BadRequestException('date query parameter is required');
    }
    this.validateDate(date);

    const doctor = await this.resolveDoctorProfile(userId);

    const overrides = await this.customRepo.find({
      where: { doctor: { id: doctor.id }, date },
      order: { startTime: 'ASC' },
    });

    if (overrides.length > 0) {
      return { source: 'custom', slots: overrides };
    }

    const [yearStr, monthStr, dayStr] = date.split('-');
    const parsed = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1, parseInt(dayStr, 10));
    const weekday = WEEKDAY_NAMES[parsed.getDay()];

    const recurring = await this.recurringRepo.find({
      where: { doctor: { id: doctor.id }, weekday },
      order: { startTime: 'ASC' },
    });

    return { source: 'recurring', slots: recurring };
  }
}
