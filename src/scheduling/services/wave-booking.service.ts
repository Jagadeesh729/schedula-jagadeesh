import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Appointment } from '../entities/appointment.entity';
import { SchedulingType } from '../enums/scheduling-type.enum';

function hasErrorCode(error: unknown): error is { code: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
  );
}

@Injectable()
export class WaveBookingService {
  constructor(private readonly dataSource: DataSource) {}

  async bookWaveToken(
    doctorId: string,
    patientId: string | null,
    date: string,
    window: string,
    maxCapacity: number,
  ): Promise<Appointment> {
    if (maxCapacity <= 0) {
      throw new BadRequestException('capacity <= 0');
    }

    return await this.dataSource.transaction(async (manager) => {
      // Query existing confirmed appointments for this doctor, date, and window with write lock
      const existingBookings = await manager
        .createQueryBuilder(Appointment, 'appointment')
        .setLock('pessimistic_write')
        .where('appointment.doctorId = :doctorId', { doctorId })
        .andWhere('appointment.date = :date', { date })
        .andWhere('appointment.window = :window', { window })
        .andWhere('appointment.status = :status', { status: 'CONFIRMED' })
        .getMany();

      // Check duplicate booking if patientId is provided
      if (patientId) {
        const hasDuplicate = existingBookings.some(
          (b) => b.patientId === patientId,
        );
        if (hasDuplicate) {
          throw new ConflictException(
            'Patient already booked for this wave window',
          );
        }
      }

      if (existingBookings.length >= maxCapacity) {
        throw new ConflictException(
          'Wave Full: Maximum capacity reached for this window',
        );
      }

      const token = existingBookings.length + 1;

      const appointment = manager.create(Appointment, {
        doctorId,
        patientId: patientId || null,
        scheduleType: SchedulingType.WAVE,
        date,
        window,
        token,
        status: 'CONFIRMED',
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
}
