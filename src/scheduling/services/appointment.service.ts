import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Appointment } from '../entities/appointment.entity';
import { SchedulingConfig } from '../entities/scheduling-config.entity';
import { DoctorProfile } from '../../doctor/entities/doctor-profile.entity';
import { PatientProfile } from '../../patient/entities/patient-profile.entity';
import { RecurringAvailability } from '../../doctor/entities/recurring-availability.entity';
import { CustomAvailability } from '../../doctor/entities/custom-availability.entity';
import { Weekday } from '../../doctor/enums/weekday.enum';
import { CreateAppointmentDto } from '../dto/scheduling.dto';
import { SchedulingType } from '../enums/scheduling-type.enum';
import { AppointmentStatus } from '../enums/appointment-status.enum';

export interface GeneratedStreamSlot {
  startTime: string;
  endTime: string;
  available: boolean;
}

function hasErrorCode(error: unknown): error is { code: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
  );
}

@Injectable()
export class AppointmentService {
  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,
    @InjectRepository(SchedulingConfig)
    private readonly configRepo: Repository<SchedulingConfig>,
    @InjectRepository(DoctorProfile)
    private readonly doctorProfileRepo: Repository<DoctorProfile>,
    @InjectRepository(PatientProfile)
    private readonly patientProfileRepo: Repository<PatientProfile>,
    @InjectRepository(RecurringAvailability)
    private readonly recurringRepo: Repository<RecurringAvailability>,
    @InjectRepository(CustomAvailability)
    private readonly overrideRepo: Repository<CustomAvailability>,
    private readonly dataSource: DataSource,
  ) {}

  private timeToMinutes(time: string): number {
    const parts = time.split(':').map(Number);
    return parts[0] * 60 + parts[1];
  }

  private minutesToTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }

  private validateDateNotPast(dateStr: string): void {
    const targetDate = new Date(`${dateStr}T23:59:59Z`);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    if (targetDate < today) {
      throw new BadRequestException(
        'Cannot book appointments for past dates or times',
      );
    }
  }

  private validateDateTimeNotPast(dateStr: string, timeStr?: string): void {
    const now = new Date();
    if (timeStr) {
      const target = new Date(`${dateStr}T${timeStr.slice(0, 5)}:00Z`);
      const nowUtc = new Date(now.toISOString());
      if (target < nowUtc) {
        throw new BadRequestException(
          'Cannot book or cancel appointments for past dates or times',
        );
      }
    } else {
      this.validateDateNotPast(dateStr);
    }
  }

  private getWeekdayName(dateStr: string): string {
    const dateObj = new Date(`${dateStr}T00:00:00Z`);
    const days = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];
    return days[dateObj.getUTCDay()];
  }

  private async resolveDoctorProfile(
    doctorIdOrUserId: string,
  ): Promise<DoctorProfile> {
    const doctor = await this.doctorProfileRepo.findOne({
      where: [{ id: doctorIdOrUserId }, { user: { id: doctorIdOrUserId } }],
      relations: { user: true },
    });
    if (!doctor) {
      throw new NotFoundException('Doctor profile not found');
    }
    return doctor;
  }

  private async resolvePatientProfile(
    patientIdOrUserId: string,
  ): Promise<PatientProfile> {
    const patient = await this.patientProfileRepo.findOne({
      where: [{ id: patientIdOrUserId }, { user: { id: patientIdOrUserId } }],
      relations: { user: true },
    });
    if (!patient) {
      throw new NotFoundException('Patient profile not found');
    }
    return patient;
  }

  private async getAvailabilityWindowsForDate(
    doctorId: string,
    date: string,
  ): Promise<{ startTime: string; endTime: string }[]> {
    const overrides = await this.overrideRepo.find({
      where: { doctor: { id: doctorId }, date },
    });

    if (overrides.length > 0) {
      return overrides.map((o) => ({
        startTime: o.startTime,
        endTime: o.endTime,
      }));
    }

    const weekdayStr = this.getWeekdayName(date);
    const recurring = await this.recurringRepo.find({
      where: { doctor: { id: doctorId }, weekday: weekdayStr as Weekday },
    });

    return recurring.map((r) => ({
      startTime: r.startTime,
      endTime: r.endTime,
    }));
  }

  generateSlotsForWindow(
    windowStart: string,
    windowEnd: string,
    slotDuration: number,
    bufferTime: number,
    bookedAppointments: Appointment[],
  ): GeneratedStreamSlot[] {
    const startMin = this.timeToMinutes(windowStart);
    const endMin = this.timeToMinutes(windowEnd);
    const windowDuration = endMin - startMin;

    if (slotDuration <= 0) {
      throw new BadRequestException('invalid slot duration');
    }
    if (bufferTime < 0) {
      throw new BadRequestException('negative buffer');
    }
    if (slotDuration > windowDuration) {
      throw new BadRequestException('duration exceeds window');
    }

    const slots: GeneratedStreamSlot[] = [];
    let current = startMin;

    while (current + slotDuration <= endMin) {
      const slotStartMin = current;
      const slotEndMin = current + slotDuration;
      const slotStartStr = this.minutesToTime(slotStartMin);
      const slotEndStr = this.minutesToTime(slotEndMin);

      const isBooked = bookedAppointments.some((app) => {
        if (
          app.status === AppointmentStatus.CANCELLED ||
          !app.slotStartTime ||
          !app.slotEndTime
        ) {
          return false;
        }
        const appStartMin = this.timeToMinutes(app.slotStartTime);
        const appEndMin = this.timeToMinutes(app.slotEndTime);
        return slotStartMin < appEndMin && appStartMin < slotEndMin;
      });

      slots.push({
        startTime: slotStartStr,
        endTime: slotEndStr,
        available: !isBooked,
      });

      current += slotDuration + bufferTime;
    }

    return slots;
  }

  async getDoctorAvailability(
    doctorIdOrUserId: string,
    date: string,
  ): Promise<unknown[]> {
    if (!date) {
      throw new BadRequestException('date query parameter is required');
    }

    this.validateDateNotPast(date);
    const doctor = await this.resolveDoctorProfile(doctorIdOrUserId);

    const config = await this.configRepo.findOne({
      where: { doctorId: doctor.id },
    });
    if (!config) {
      throw new NotFoundException('Doctor scheduling configuration not found');
    }

    const windows = await this.getAvailabilityWindowsForDate(doctor.id, date);
    if (windows.length === 0) {
      return [];
    }

    const bookedAppointments = await this.appointmentRepo.find({
      where: { doctorId: doctor.id, date, status: AppointmentStatus.CONFIRMED },
    });

    if (config.schedulingType === SchedulingType.STREAM) {
      const slotDuration = config.slotDuration;
      const bufferTime = config.bufferTime ?? 0;

      if (!slotDuration || slotDuration <= 0) {
        throw new BadRequestException('invalid slot duration');
      }

      let allSlots: GeneratedStreamSlot[] = [];
      for (const win of windows) {
        const slots = this.generateSlotsForWindow(
          win.startTime,
          win.endTime,
          slotDuration,
          bufferTime,
          bookedAppointments,
        );
        allSlots = allSlots.concat(slots);
      }
      return allSlots;
    } else if (config.schedulingType === SchedulingType.WAVE) {
      const maxCapacity = config.maxCapacity;
      if (!maxCapacity || maxCapacity <= 0) {
        throw new BadRequestException('capacity <= 0');
      }

      const waveWindows: {
        window: string;
        available: boolean;
        capacity: number;
      }[] = [];
      for (const win of windows) {
        const windowStr = `${win.startTime.slice(0, 5)}-${win.endTime.slice(0, 5)}`;

        const bookedCount = bookedAppointments.filter(
          (app) =>
            app.window === windowStr ||
            (app.window &&
              app.window.slice(0, 5) === win.startTime.slice(0, 5)),
        ).length;

        const remainingCapacity = Math.max(0, maxCapacity - bookedCount);

        waveWindows.push({
          window: windowStr,
          available: remainingCapacity > 0,
          capacity: maxCapacity,
        });
      }
      return waveWindows;
    }

    throw new BadRequestException('Unknown scheduling strategy');
  }

  async bookAppointment(
    dto: CreateAppointmentDto,
    patientUserId: string,
  ): Promise<Appointment> {
    const doctor = await this.resolveDoctorProfile(dto.doctorId);
    const patient = await this.resolvePatientProfile(patientUserId);

    const config = await this.configRepo.findOne({
      where: { doctorId: doctor.id },
    });
    if (!config) {
      throw new NotFoundException('Doctor scheduling configuration not found');
    }

    const effectiveStrategy = dto.scheduleType ?? config.schedulingType;

    // Handle root-level startTime/endTime DTO shortcut
    if (!dto.slot && dto.startTime && dto.endTime) {
      dto.slot = { startTime: dto.startTime, endTime: dto.endTime };
    }

    if (effectiveStrategy === SchedulingType.STREAM) {
      if (!dto.slot || !dto.slot.startTime || !dto.slot.endTime) {
        throw new BadRequestException(
          'slot object with startTime and endTime is required for STREAM scheduling',
        );
      }

      this.validateDateTimeNotPast(dto.date, dto.slot.startTime);

      // Validate that requested slot is a valid generated slot
      const availabilitySlots = (await this.getDoctorAvailability(
        doctor.id,
        dto.date,
      )) as GeneratedStreamSlot[];
      const isValidSlot = availabilitySlots.some(
        (s) =>
          s.startTime === dto.slot!.startTime &&
          s.endTime === dto.slot!.endTime,
      );
      if (!isValidSlot) {
        throw new BadRequestException(
          'Requested slot is not a valid time slot for this doctor',
        );
      }

      const existingBooked = await this.appointmentRepo.findOne({
        where: {
          doctorId: doctor.id,
          date: dto.date,
          slotStartTime: dto.slot.startTime,
          slotEndTime: dto.slot.endTime,
          status: AppointmentStatus.CONFIRMED,
        },
      });

      if (existingBooked) {
        throw new ConflictException('Slot already booked');
      }

      const appointment = this.appointmentRepo.create({
        doctorId: doctor.id,
        patientId: patient.id,
        scheduleType: SchedulingType.STREAM,
        date: dto.date,
        slotStartTime: dto.slot.startTime,
        slotEndTime: dto.slot.endTime,
        status: AppointmentStatus.CONFIRMED,
      });

      return await this.appointmentRepo.save(appointment);
    } else if (effectiveStrategy === SchedulingType.WAVE) {
      if (!dto.window) {
        throw new BadRequestException(
          'window string is required for WAVE scheduling',
        );
      }

      this.validateDateNotPast(dto.date);

      const maxCapacity = config.maxCapacity;
      if (!maxCapacity || maxCapacity <= 0) {
        throw new BadRequestException('capacity <= 0');
      }

      return await this.dataSource.transaction(async (manager) => {
        const existingBookings = await manager
          .createQueryBuilder(Appointment, 'appointment')
          .setLock('pessimistic_write')
          .where('appointment.doctorId = :doctorId', { doctorId: doctor.id })
          .andWhere('appointment.date = :date', { date: dto.date })
          .andWhere('appointment.window = :window', { window: dto.window })
          .andWhere('appointment.status = :status', {
            status: AppointmentStatus.CONFIRMED,
          })
          .getMany();

        const hasDuplicate = existingBookings.some(
          (b) => b.patientId === patient.id,
        );
        if (hasDuplicate) {
          throw new ConflictException(
            'Patient already booked for this wave window',
          );
        }

        if (existingBookings.length >= maxCapacity) {
          throw new ConflictException(
            'Wave Full: Maximum capacity reached for this window',
          );
        }

        // Lowest missing positive integer algorithm for collision-free tokens
        const activeTokens = new Set(
          existingBookings
            .map((b) => b.token)
            .filter((t): t is number => t !== null && t !== undefined),
        );
        let token = 1;
        while (activeTokens.has(token)) {
          token++;
        }

        const appointment = manager.create(Appointment, {
          doctorId: doctor.id,
          patientId: patient.id,
          scheduleType: SchedulingType.WAVE,
          date: dto.date,
          window: dto.window,
          token,
          status: AppointmentStatus.CONFIRMED,
        });

        try {
          return await manager.save(appointment);
        } catch (error: unknown) {
          if (hasErrorCode(error) && error.code === '23505') {
            throw new ConflictException('Wave booking could not be completed');
          }
          throw error;
        }
      });
    }

    throw new BadRequestException('Invalid scheduleType');
  }

  async getPatientAppointments(
    patientUserId: string,
  ): Promise<Record<string, unknown>[]> {
    const patient = await this.resolvePatientProfile(patientUserId);
    const appointments = await this.appointmentRepo.find({
      where: { patientId: patient.id },
      relations: { doctor: { user: true } },
      order: { date: 'DESC', createdAt: 'DESC' },
    });

    return appointments.map((app) => ({
      appointmentId: app.id,
      id: app.id,
      doctorId: app.doctorId,
      patientId: app.patientId,
      scheduleType: app.scheduleType,
      date: app.date,
      status: app.status,
      token: app.token ?? null,
      window: app.window ?? null,
      slot:
        app.slotStartTime && app.slotEndTime
          ? { startTime: app.slotStartTime, endTime: app.slotEndTime }
          : null,
      startTime: app.slotStartTime ?? null,
      endTime: app.slotEndTime ?? null,
      doctor: {
        id: app.doctor.id,
        name: app.doctor.fullName ?? app.doctor.user?.name ?? '',
        specialization: app.doctor.specialization,
        email: app.doctor.user?.email ?? '',
      },
      createdAt: app.createdAt,
    }));
  }

  async getDoctorAppointments(
    doctorUserId: string,
  ): Promise<Record<string, unknown>[]> {
    const doctor = await this.resolveDoctorProfile(doctorUserId);
    const appointments = await this.appointmentRepo.find({
      where: { doctorId: doctor.id },
      relations: { patient: { user: true } },
      order: { date: 'DESC', createdAt: 'DESC' },
    });

    return appointments.map((app) => ({
      appointmentId: app.id,
      id: app.id,
      doctorId: app.doctorId,
      patientId: app.patientId,
      scheduleType: app.scheduleType,
      date: app.date,
      status: app.status,
      token: app.token ?? null,
      window: app.window ?? null,
      slot:
        app.slotStartTime && app.slotEndTime
          ? { startTime: app.slotStartTime, endTime: app.slotEndTime }
          : null,
      startTime: app.slotStartTime ?? null,
      endTime: app.slotEndTime ?? null,
      patient: app.patient
        ? {
            id: app.patient.id,
            name: app.patient.fullName ?? app.patient.user?.name ?? '',
            email: app.patient.user?.email ?? '',
            phone: app.patient.contactDetails ?? '',
          }
        : null,
      createdAt: app.createdAt,
    }));
  }

  async cancelAppointment(
    appointmentId: string,
    patientUserId: string,
  ): Promise<Record<string, unknown>> {
    const appointment = await this.appointmentRepo.findOne({
      where: { id: appointmentId },
      relations: { patient: { user: true } },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (
      !appointment.patient ||
      !appointment.patient.user ||
      appointment.patient.user.id !== patientUserId
    ) {
      throw new ForbiddenException(
        'You are not authorized to cancel this appointment',
      );
    }

    if (appointment.status === AppointmentStatus.CANCELLED) {
      throw new BadRequestException('Appointment is already cancelled');
    }

    this.validateDateTimeNotPast(
      appointment.date,
      appointment.slotStartTime ?? undefined,
    );

    appointment.status = AppointmentStatus.CANCELLED;
    const saved = await this.appointmentRepo.save(appointment);

    return {
      appointmentId: saved.id,
      id: saved.id,
      status: saved.status,
      message: 'Appointment cancelled successfully',
    };
  }

  async getAppointmentById(
    appointmentId: string,
    currentUser: { id: string; role: string },
  ): Promise<Record<string, unknown>> {
    const appointment = await this.appointmentRepo.findOne({
      where: { id: appointmentId },
      relations: { doctor: { user: true }, patient: { user: true } },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    const isAssignedDoctor =
      appointment.doctor &&
      appointment.doctor.user &&
      appointment.doctor.user.id === currentUser.id;
    const isOwnerPatient =
      appointment.patient &&
      appointment.patient.user &&
      appointment.patient.user.id === currentUser.id;

    if (!isAssignedDoctor && !isOwnerPatient) {
      throw new ForbiddenException(
        'You are not authorized to view this appointment',
      );
    }

    return {
      appointmentId: appointment.id,
      doctorId: appointment.doctorId,
      patientId: appointment.patientId,
      scheduleType: appointment.scheduleType,
      token: appointment.token ?? null,
      window: appointment.window ?? null,
      slot:
        appointment.slotStartTime && appointment.slotEndTime
          ? {
              startTime: appointment.slotStartTime,
              endTime: appointment.slotEndTime,
            }
          : null,
      date: appointment.date,
      status: appointment.status,
      createdAt: appointment.createdAt,
    };
  }
}
