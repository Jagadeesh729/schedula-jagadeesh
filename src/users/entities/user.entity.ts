import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password?: string; // Opted as optional for returning sanitised payloads

  @Column()
  role: string; // 'DOCTOR' | 'PATIENT'

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
