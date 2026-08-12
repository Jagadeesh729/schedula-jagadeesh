import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { PatientProfile } from '../../patient/entities/patient-profile.entity';
import { NotificationType } from '../enums/notification-type.enum';

@Entity('notifications')
@Index('idx_notification_patient_created', ['patientId', 'createdAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId!: string;

  @ManyToOne(() => PatientProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient!: PatientProfile;

  @Column({ type: 'enum', enum: NotificationType })
  type!: NotificationType;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({ name: 'appointment_id', type: 'uuid', nullable: true })
  appointmentId?: string;

  @Index('idx_notification_event_unique', {
    unique: true,
    where: '"event_id" IS NOT NULL',
  })
  @Column({ name: 'event_id', type: 'varchar', length: 255, nullable: true })
  eventId?: string;

  @Column({ name: 'is_read', type: 'boolean', default: false })
  isRead!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
