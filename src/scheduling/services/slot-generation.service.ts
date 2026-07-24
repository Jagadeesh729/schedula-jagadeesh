import { BadRequestException, Injectable } from '@nestjs/common';
import { Appointment } from '../entities/appointment.entity';

export interface GeneratedStreamSlot {
  startTime: string;
  endTime: string;
  available: boolean;
}

@Injectable()
export class SlotGenerationService {
  public timeToMinutes(time: string): number {
    const parts = time.split(':').map(Number);
    return parts[0] * 60 + parts[1];
  }

  public minutesToTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
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

      // Check if slot overlaps with any booked appointment
      const isBooked = bookedAppointments.some((app) => {
        if (app.status === 'CANCELLED' || !app.slotStartTime || !app.slotEndTime) {
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
}
