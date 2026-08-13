import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { Notification } from './entities/notification.entity';
import { PatientProfile } from '../patient/entities/patient-profile.entity';
import { Appointment } from '../scheduling/entities/appointment.entity';
import { NotificationService } from './notification.service';
import { ReminderService } from './reminder.service';
import { NotificationController } from './notification.controller';
import { NotificationGateway } from './notification.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, PatientProfile, Appointment]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'supersecretkey',
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [NotificationController],
  providers: [NotificationService, ReminderService, NotificationGateway],
  exports: [NotificationService, ReminderService, NotificationGateway],
})
export class NotificationModule {}
