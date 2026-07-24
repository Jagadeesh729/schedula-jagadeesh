import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchedulingConfig } from './entities/scheduling-config.entity';
import { Appointment } from './entities/appointment.entity';
import { DoctorProfile } from '../doctor/entities/doctor-profile.entity';
import { RecurringAvailability } from '../doctor/entities/recurring-availability.entity';
import { CustomAvailability } from '../doctor/entities/custom-availability.entity';
import { SchedulingConfigService } from './services/scheduling-config.service';
import { SlotGenerationService } from './services/slot-generation.service';
import { WaveBookingService } from './services/wave-booking.service';
import { AppointmentService } from './services/appointment.service';
import { DoctorsSchedulingController } from './controllers/doctors-scheduling.controller';
import { AppointmentController } from './controllers/appointment.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SchedulingConfig,
      Appointment,
      DoctorProfile,
      RecurringAvailability,
      CustomAvailability,
    ]),
  ],
  controllers: [DoctorsSchedulingController, AppointmentController],
  providers: [
    SchedulingConfigService,
    SlotGenerationService,
    WaveBookingService,
    AppointmentService,
  ],
  exports: [
    SchedulingConfigService,
    SlotGenerationService,
    WaveBookingService,
    AppointmentService,
  ],
})
export class SchedulingModule {}
