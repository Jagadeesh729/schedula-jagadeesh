import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appointment } from '../entities/appointment.entity';
import { SchedulingConfig } from '../entities/scheduling-config.entity';
import { DoctorProfile } from '../../doctor/entities/doctor-profile.entity';
import { RecurringAvailability } from '../../doctor/entities/recurring-availability.entity';
import { CustomAvailability } from '../../doctor/entities/custom-availability.entity';
import { Weekday } from '../../doctor/enums/weekday.enum';
import { SchedulingType } from '../enums/scheduling-type.enum';
import { CreateAppointmentDto } from '../dto/create-appointment.dto';
import {
  GeneratedStreamSlot,
  SlotGenerationService,
} from './slot-generation.service';
import { WaveBookingService } from './wave-booking.service';

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
export class AppointmentService {
  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentRepo: Repository<Appointment>,
    @InjectRepository(SchedulingConfig)
    private readonly configRepo: Repository<SchedulingConfig>,
    @InjectRepository(DoctorProfile)
    private readonly doctorProfileRepo: Repository<DoctorProfile>,
    @InjectRepository(RecurringAvailability)
    private readonly recurringRepo: Repository<RecurringAvailability>,
    @InjectRepository(CustomAvailability)
    private readonly customRepo: Repository<CustomAvailability>,
    private readonly slotGenService: SlotGenerationService,
    private readonly waveBookingService: WaveBookingService,
  ) {}

  private validateDateNotPast(dateStr: string): void {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [year, month, day] = dateStr.split('-').map(Number);
    const targetDate = new Date(year, month - 1, day);

    if (targetDate < today) {
      throw new BadRequestException(
        'Cannot book appointments for past dates or times',
      );
    }
  }

  async resolveDoctorProfile(doctorIdOrUserId: string): Promise<DoctorProfile> {
    let profile = await this.doctorProfileRepo.findOne({
      where: { id: doctorIdOrUserId },
    });
    if (!profile) {
      profile = await this.doctorProfileRepo.findOne({
        where: { user: { id: doctorIdOrUserId } },
      });
    }
    if (!profile) {
      throw new NotFoundException('Doctor profile not found');
    }
    return profile;
  }

  private async getAvailabilityWindowsForDate(
    doctorId: string,
    date: string,
  ): Promise<Array<{ startTime: string; endTime: string }>> {
    // 1. Check custom overrides first
    const overrides = await this.customRepo.find({
      where: { doctor: { id: doctorId }, date },
      order: { startTime: 'ASC' },
    });
    if (overrides.length > 0) {
      return overrides.map((o) => ({
        startTime: o.startTime,
        endTime: o.endTime,
      }));
    }

    // 2. Fallback to recurring availability
    const [yearStr, monthStr, dayStr] = date.split('-');
    const parsed = new Date(
      parseInt(yearStr, 10),
      parseInt(monthStr, 10) - 1,
      parseInt(dayStr, 10),
    );
    const weekday = WEEKDAY_NAMES[parsed.getDay()];

    const recurring = await this.recurringRepo.find({
      where: { doctor: { id: doctorId }, weekday },
      order: { startTime: 'ASC' },
    });

    return recurring.map((r) => ({
      startTime: r.startTime,
      endTime: r.endTime,
    }));
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
      where: { doctorId: doctor.id, date, status: 'CONFIRMED' },
    });

    if (config.schedulingType === SchedulingType.STREAM) {
      const slotDuration = config.slotDuration;
      const bufferTime = config.bufferTime ?? 0;

      if (!slotDuration || slotDuration <= 0) {
        throw new BadRequestException('invalid slot duration');
      }

      let allSlots: GeneratedStreamSlot[] = [];
      for (const win of windows) {
        const slots = this.slotGenService.generateSlotsForWindow(
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
        // Standard format "HH:MM-HH:MM" e.g. "10:00-11:00"
        const windowStr = `${win.startTime.slice(0, 5)}-${win.endTime.slice(0, 5)}`;

        const bookedCount = bookedAppointments.filter(
          (app) =>
            app.scheduleType === SchedulingType.WAVE &&
            app.window === windowStr,
        ).length;

        waveWindows.push({
          window: windowStr,
          available: bookedCount < maxCapacity,
          capacity: maxCapacity,
        });
      }
      return waveWindows;
    }

    throw new BadRequestException('invalid scheduling type');
  }

  async createAppointment(
    dto: CreateAppointmentDto,
    currentUserId?: string,
    currentUserRole?: string,
  ): Promise<Record<string, unknown>> {
    if (!currentUserId) {
      throw new UnauthorizedException('Authentication required');
    }
    if (currentUserRole && currentUserRole !== 'PATIENT') {
      throw new ForbiddenException('Only patients can create appointments');
    }

    if (!dto.date) {
      throw new BadRequestException('date is required');
    }
    this.validateDateNotPast(dto.date);

    const doctor = await this.resolveDoctorProfile(dto.doctorId);

    const config = await this.configRepo.findOne({
      where: { doctorId: doctor.id },
    });
    if (!config) {
      throw new NotFoundException('Doctor scheduling configuration not found');
    }

    const scheduleType = dto.scheduleType || config.schedulingType;
    const patientId = currentUserId;

    const windows = await this.getAvailabilityWindowsForDate(
      doctor.id,
      dto.date,
    );
    if (windows.length === 0) {
      throw new BadRequestException(
        'Doctor has no availability on the specified date',
      );
    }

    if (scheduleType === SchedulingType.STREAM) {
      if (!dto.slot || !dto.slot.startTime || !dto.slot.endTime) {
        throw new BadRequestException(
          'Slot startTime and endTime are required for STREAM scheduling',
        );
      }

      const reqStart = this.slotGenService.timeToMinutes(dto.slot.startTime);
      const reqEnd = this.slotGenService.timeToMinutes(dto.slot.endTime);

      if (reqStart >= reqEnd) {
        throw new BadRequestException('startTime must be before endTime');
      }

      // Check if slot falls within any availability window
      const fitsWindow = windows.some((win) => {
        const winStart = this.slotGenService.timeToMinutes(win.startTime);
        const winEnd = this.slotGenService.timeToMinutes(win.endTime);
        return reqStart >= winStart && reqEnd <= winEnd;
      });

      if (!fitsWindow) {
        throw new BadRequestException(
          'Requested slot is outside doctor availability window',
        );
      }

      // Check if slot overlaps with existing booked appointments
      const existingBookings = await this.appointmentRepo.find({
        where: { doctorId: doctor.id, date: dto.date, status: 'CONFIRMED' },
      });

      const isOverlapping = existingBookings.some((app) => {
        if (!app.slotStartTime || !app.slotEndTime) return false;
        const appStart = this.slotGenService.timeToMinutes(app.slotStartTime);
        const appEnd = this.slotGenService.timeToMinutes(app.slotEndTime);
        return reqStart < appEnd && appStart < reqEnd;
      });

      if (isOverlapping) {
        throw new ConflictException('Slot already booked');
      }

      const appointment = this.appointmentRepo.create({
        doctorId: doctor.id,
        patientId,
        scheduleType: SchedulingType.STREAM,
        date: dto.date,
        slotStartTime: dto.slot.startTime,
        slotEndTime: dto.slot.endTime,
        status: 'CONFIRMED',
      });

      const saved = await this.appointmentRepo.save(appointment);

      return {
        appointmentId: saved.id,
        scheduleType: saved.scheduleType,
        token: null,
        window: null,
        slot: {
          startTime: saved.slotStartTime
            ? saved.slotStartTime.slice(0, 5)
            : dto.slot.startTime,
          endTime: saved.slotEndTime
            ? saved.slotEndTime.slice(0, 5)
            : dto.slot.endTime,
        },
        status: saved.status,
      };
    } else if (scheduleType === SchedulingType.WAVE) {
      if (!dto.window) {
        throw new BadRequestException('window is required for WAVE scheduling');
      }

      // Check if window matches an availability window
      const validWindow = windows.some((win) => {
        const winStr = `${win.startTime.slice(0, 5)}-${win.endTime.slice(0, 5)}`;
        return winStr === dto.window;
      });

      if (!validWindow) {
        throw new BadRequestException(
          'Requested window does not match doctor availability',
        );
      }

      const saved = await this.waveBookingService.bookWaveToken(
        doctor.id,
        patientId,
        dto.date,
        dto.window,
        config.maxCapacity!,
      );

      return {
        appointmentId: saved.id,
        scheduleType: saved.scheduleType,
        token: saved.token,
        window: saved.window,
        slot: null,
        status: saved.status,
      };
    }

    throw new BadRequestException('invalid scheduling type');
  }

  async getAppointmentById(
    id: string,
    currentUserId?: string,
    currentUserRole?: string,
  ): Promise<Record<string, unknown>> {
    if (!currentUserId) {
      throw new UnauthorizedException('Authentication required');
    }

    const appointment = await this.appointmentRepo.findOne({
      where: { id },
      relations: { doctor: true },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (currentUserRole === 'PATIENT') {
      if (appointment.patientId !== currentUserId) {
        throw new ForbiddenException(
          'You do not have access to this appointment',
        );
      }
    } else if (currentUserRole === 'DOCTOR') {
      const doctorProfile = await this.resolveDoctorProfile(currentUserId);
      if (appointment.doctorId !== doctorProfile.id) {
        throw new ForbiddenException(
          'You do not have access to this appointment',
        );
      }
    } else {
      throw new ForbiddenException(
        'You do not have access to this appointment',
      );
    }

    return {
      appointmentId: appointment.id,
      doctorId: appointment.doctorId,
      patientId: appointment.patientId,
      scheduleType: appointment.scheduleType,
      token: appointment.token,
      window: appointment.window,
      slot:
        appointment.slotStartTime && appointment.slotEndTime
          ? {
              startTime: appointment.slotStartTime.slice(0, 5),
              endTime: appointment.slotEndTime.slice(0, 5),
            }
          : null,
      date: appointment.date,
      status: appointment.status,
      createdAt: appointment.createdAt,
    };
  }
}
