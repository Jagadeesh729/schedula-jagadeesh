import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as dotenv from 'dotenv';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { DoctorModule } from './doctor/doctor.module';
import { PatientModule } from './patient/patient.module';
import { SchedulingModule } from './scheduling/scheduling.module';
import { RateLimiterGuard } from './guards/rate-limiter.guard';
import { CreateUsers1784700000000 } from './migrations/1784700000000-CreateUsers';
import { CreateDoctorProfile1784700000001 } from './migrations/1784700000001-CreateDoctorProfile';
import { CreatePatientProfile1784700000002 } from './migrations/1784700000002-CreatePatientProfile';
import { CreateDoctorAvailability1784800000001 } from './migrations/1784800000001-CreateDoctorAvailability';
import { CreateAdvancedScheduling1784900000001 } from './migrations/1784900000001-CreateAdvancedScheduling';

dotenv.config();

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL || 'postgresql://postgres:postgres123@localhost:5432/schedula',
      autoLoadEntities: true,
      synchronize: false, // Disables automatic schema sync (required for Task 4)
      migrations: [
        CreateUsers1784700000000,
        CreateDoctorProfile1784700000001,
        CreatePatientProfile1784700000002,
        CreateDoctorAvailability1784800000001,
        CreateAdvancedScheduling1784900000001,
      ],
      migrationsRun: true, // Runs migrations automatically on startup
    }),
    UsersModule,
    AuthModule,
    DoctorModule,
    PatientModule,
    SchedulingModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: RateLimiterGuard,
    },
  ],
})
export class AppModule {}
