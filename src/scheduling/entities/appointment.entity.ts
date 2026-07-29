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

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
