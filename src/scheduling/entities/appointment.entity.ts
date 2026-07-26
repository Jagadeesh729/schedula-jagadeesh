import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { DoctorProfile } from '../../doctor/entities/doctor-profile.entity';
import { User } from '../../users/entities/user.entity';
import { SchedulingType } from '../enums/scheduling-type.enum';

export enum AppointmentStatus {
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
}

@Entity('appointments')
export class Appointment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => DoctorProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'doctor_id' })
  doctor!: DoctorProfile;

  @Column({ name: 'doctor_id' })
  doctorId!: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'patient_id' })
  patient!: User | null;

  @Column({ name: 'patient_id', nullable: true })
  patientId!: string | null;

  @Column({ name: 'schedule_type', type: 'varchar' })
  scheduleType!: SchedulingType;

  @Column({ type: 'date' })
  date!: string;

  @Column({ name: 'slot_start_time', type: 'time', nullable: true })
  slotStartTime!: string | null;

  @Column({ name: 'slot_end_time', type: 'time', nullable: true })
  slotEndTime!: string | null;

  @Column({ type: 'varchar', nullable: true })
  window!: string | null;

  @Column({ type: 'integer', nullable: true })
  token!: number | null;

  @Column({ type: 'varchar', default: 'CONFIRMED' })
  status!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
