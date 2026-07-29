import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DoctorProfile } from '../../doctor/entities/doctor-profile.entity';
import { SchedulingType } from '../enums/scheduling-type.enum';

@Entity('scheduling_configs')
export class SchedulingConfig {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'doctor_id', type: 'uuid', unique: true })
  doctorId!: string;

  @OneToOne(() => DoctorProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'doctor_id' })
  doctor!: DoctorProfile;

  @Column({ name: 'scheduling_type', type: 'varchar' })
  schedulingType!: SchedulingType;

  @Column({ name: 'slot_duration', type: 'int', nullable: true })
  slotDuration?: number;

  @Column({ name: 'buffer_time', type: 'int', default: 0, nullable: true })
  bufferTime?: number;

  @Column({ name: 'max_capacity', type: 'int', nullable: true })
  maxCapacity?: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
