import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('patient_profiles')
export class PatientProfile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'full_name' })
  fullName!: string;

  @Column()
  age!: number;

  @Column()
  gender!: string;

  @Column({ name: 'contact_details' })
  contactDetails!: string;

  @Column({ name: 'basic_health_information', type: 'text', nullable: true })
  basicHealthInformation?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
