import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('doctor_profiles')
export class DoctorProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'full_name' })
  fullName: string;

  @Column()
  specialization: string;

  @Column()
  experience: number;

  @Column()
  qualification: string;

  @Column({ name: 'consultation_fee', type: 'decimal', precision: 10, scale: 2 })
  consultationFee: number;

  @Column()
  availability: string;

  @Column({ name: 'profile_details', type: 'text' })
  profileDetails: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
