import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RecurringAvailability } from './entities/recurring-availability.entity';
import { CustomAvailability } from './entities/custom-availability.entity';
import { DoctorProfile } from './entities/doctor-profile.entity';
import { Weekday } from './enums/weekday.enum';
import { CreateRecurringAvailabilityDto } from './dto/create-recurring-availability.dto';
import { UpdateRecurringAvailabilityDto } from './dto/update-recurring-availability.dto';
import { CreateCustomAvailabilityDto } from './dto/create-custom-availability.dto';

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
  ) {}

  // ─── Private Helpers ────────────────────────────────────────────────────────

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
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
      where: { user: { id: userId } },
    });
    if (!profile) {
      throw new NotFoundException('Doctor profile not found');
    }
    return profile;
  }

  // ─── Recurring Availability ──────────────────────────────────────────────────

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
  ): Promise<RecurringAvailability> {
    const doctor = await this.resolveDoctorProfile(userId);

    const slot = await this.recurringRepo.findOne({
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

    const existing = await this.recurringRepo.find({
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

    return this.recurringRepo.save(slot);
  }

  async deleteRecurring(userId: string, id: string): Promise<RecurringAvailability> {
    const doctor = await this.resolveDoctorProfile(userId);

    const slot = await this.recurringRepo.findOne({
      where: { id },
      relations: { doctor: true },
    });
    if (!slot) {
      throw new NotFoundException('Recurring availability not found');
    }
    if (slot.doctor.id !== doctor.id) {
      throw new ForbiddenException('You are not allowed to delete this availability');
    }

    return this.recurringRepo.remove(slot);
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
