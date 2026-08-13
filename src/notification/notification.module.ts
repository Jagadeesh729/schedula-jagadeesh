import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { PatientProfile } from '../patient/entities/patient-profile.entity';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { NotificationGateway } from './notification.gateway';
import { NotificationQueueService } from './notification.queue';

@Module({
  imports: [TypeOrmModule.forFeature([Notification, PatientProfile])],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationGateway, NotificationQueueService],
  exports: [NotificationService, NotificationGateway, NotificationQueueService],
})
export class NotificationModule {}
