import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appointment } from './entities/appointment.entity';
import { SchedulingConfig } from './entities/scheduling-config.entity';
import { DoctorProfile } from '../doctor/entities/doctor-profile.entity';
import { PatientProfile } from '../patient/entities/patient-profile.entity';
import { RecurringAvailability } from '../doctor/entities/recurring-availability.entity';
import { CustomAvailability } from '../doctor/entities/custom-availability.entity';
import {
  DoctorsSchedulingController,
  SchedulingConfigController,
  DoctorSchedulingConfigController,
  DoctorAppointmentsController,
} from './controllers/doctors-scheduling.controller';
import { AppointmentController } from './controllers/appointment.controller';
import { SchedulingConfigService } from './services/scheduling-config.service';
import { AppointmentService } from './services/appointment.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Appointment,
      SchedulingConfig,
      DoctorProfile,
      PatientProfile,
      RecurringAvailability,
      CustomAvailability,
    ]),
  ],
  controllers: [
    DoctorsSchedulingController,
    SchedulingConfigController,
    DoctorSchedulingConfigController,
    DoctorAppointmentsController,
    AppointmentController,
  ],
  providers: [SchedulingConfigService, AppointmentService],
  exports: [SchedulingConfigService, AppointmentService],
})
export class SchedulingModule {}
