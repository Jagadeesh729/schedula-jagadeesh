import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as dotenv from 'dotenv';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { DoctorModule } from './doctor/doctor.module';
import { PatientModule } from './patient/patient.module';
import { CreateDoctorProfile1784700000001 } from './migrations/1784700000001-CreateDoctorProfile';
import { CreatePatientProfile1784700000002 } from './migrations/1784700000002-CreatePatientProfile';

dotenv.config();

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL || 'postgresql://postgres:postgres123@localhost:5432/schedula',
      autoLoadEntities: true,
      synchronize: false, // Disables automatic schema sync (required for Task 4)
      migrations: [CreateDoctorProfile1784700000001, CreatePatientProfile1784700000002],
      migrationsRun: true, // Runs migrations automatically on startup
    }),
    UsersModule,
    AuthModule,
    DoctorModule,
    PatientModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
