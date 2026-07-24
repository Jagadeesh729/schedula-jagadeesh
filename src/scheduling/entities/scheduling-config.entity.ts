import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { DoctorProfile } from '../../doctor/entities/doctor-profile.entity';
import { SchedulingType } from '../enums/scheduling-type.enum';

@Entity('scheduling_configs')
export class SchedulingConfig {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne(() => DoctorProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'doctor_id' })
  doctor!: DoctorProfile;

  @Column({ name: 'doctor_id' })
  doctorId!: string;

  @Column({
    type: 'varchar',
    name: 'scheduling_type',
  })
  schedulingType!: SchedulingType;

  @Column({ name: 'slot_duration', type: 'integer', nullable: true })
  slotDuration!: number | null;

  @Column({ name: 'buffer_time', type: 'integer', nullable: true })
  bufferTime!: number | null;

  @Column({ name: 'max_capacity', type: 'integer', nullable: true })
  maxCapacity!: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
