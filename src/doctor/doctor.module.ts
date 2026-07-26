import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DoctorProfile } from './entities/doctor-profile.entity';
import { RecurringAvailability } from './entities/recurring-availability.entity';
import { CustomAvailability } from './entities/custom-availability.entity';
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
    ]),
  ],
  controllers: [DoctorController, DoctorAvailabilityController],
  providers: [DoctorService, DoctorAvailabilityService],
  exports: [DoctorService],
})
export class DoctorModule {}
