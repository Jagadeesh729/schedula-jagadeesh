import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as dotenv from 'dotenv';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { DoctorController } from './doctor/doctor.controller';
import { PatientController } from './patient/patient.controller';

dotenv.config();

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL || 'postgresql://postgres:postgres123@localhost:5432/schedula',
      autoLoadEntities: true,
      synchronize: true, // Auto sync schema during local development
    }),
    UsersModule,
    AuthModule,
  ],
  controllers: [AppController, DoctorController, PatientController],
  providers: [AppService],
})
export class AppModule {}
