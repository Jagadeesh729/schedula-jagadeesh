import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DoctorProfile } from '../../doctor/entities/doctor-profile.entity';
import { PatientProfile } from '../../patient/entities/patient-profile.entity';
import { SchedulingType } from '../enums/scheduling-type.enum';
import { AppointmentStatus } from '../enums/appointment-status.enum';

@Entity('appointments')
export class Appointment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'doctor_id', type: 'uuid' })
  doctorId!: string;

  @ManyToOne(() => DoctorProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'doctor_id' })
  doctor!: DoctorProfile;

  @Column({ name: 'patient_id', type: 'uuid', nullable: true })
  patientId!: string | null;

  @ManyToOne(() => PatientProfile, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'patient_id' })
  patient!: PatientProfile | null;

  @Column({ name: 'schedule_type', type: 'varchar' })
  scheduleType!: SchedulingType;

  @Column({ type: 'varchar' })
  date!: string;

  @Column({ name: 'slot_start_time', type: 'varchar', nullable: true })
  slotStartTime?: string;

  @Column({ name: 'slot_end_time', type: 'varchar', nullable: true })
  slotEndTime?: string;

  @Column({ type: 'varchar', nullable: true })
  window?: string;

  @Column({ type: 'int', nullable: true })
  token?: number;

  @Column({ type: 'varchar', default: AppointmentStatus.CONFIRMED })
  status!: AppointmentStatus;

  @Column({ name: 'previous_date', type: 'varchar', nullable: true })
  previousDate?: string;

  @Column({ name: 'previous_slot_start_time', type: 'varchar', nullable: true })
  previousSlotStartTime?: string;

  @Column({ name: 'previous_slot_end_time', type: 'varchar', nullable: true })
  previousSlotEndTime?: string;

  @Column({ name: 'previous_window', type: 'varchar', nullable: true })
  previousWindow?: string;

  @Column({ name: 'previous_token', type: 'int', nullable: true })
  previousToken?: number;

  @Column({ name: 'is_auto_rescheduled', type: 'boolean', default: false })
  isAutoRescheduled!: boolean;

  @Column({ name: 'rescheduled_reason', type: 'varchar', nullable: true })
  rescheduledReason?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
