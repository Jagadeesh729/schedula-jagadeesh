import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DoctorProfile } from './entities/doctor-profile.entity';
import { RecurringAvailability } from './entities/recurring-availability.entity';
import { CustomAvailability } from './entities/custom-availability.entity';
import { Appointment } from '../scheduling/entities/appointment.entity';
import { SchedulingConfig } from '../scheduling/entities/scheduling-config.entity';
import { DoctorService } from './doctor.service';
import { DoctorController } from './doctor.controller';
import { DoctorAvailabilityService } from './doctor-availability.service';
import { DoctorAvailabilityController } from './doctor-availability.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DoctorProfile,
      RecurringAvailability,
      CustomAvailability,
      Appointment,
      SchedulingConfig,
    ]),
  ],
  controllers: [DoctorController, DoctorAvailabilityController],
  providers: [DoctorService, DoctorAvailabilityService],
  exports: [DoctorService, DoctorAvailabilityService],
})
export class DoctorModule {}
