import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PatientProfile } from './entities/patient-profile.entity';
import { CreatePatientProfileDto } from './dto/create-patient-profile.dto';
import { UpdatePatientProfileDto } from './dto/update-patient-profile.dto';
import { User } from '../users/entities/user.entity';

@Injectable()
export class PatientService {
  constructor(
    @InjectRepository(PatientProfile)
    private readonly patientRepository: Repository<PatientProfile>,
  ) {}

  async create(userId: string, dto: CreatePatientProfileDto): Promise<PatientProfile> {
    const existing = await this.patientRepository.findOne({
      where: { user: { id: userId } },
    });
    if (existing) {
      throw new ConflictException('Patient profile already exists');
    }

    const profile = this.patientRepository.create({
      ...dto,
      user: { id: userId } as User,
    });

    return this.patientRepository.save(profile);
  }

  async findOne(userId: string): Promise<PatientProfile> {
    const profile = await this.patientRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!profile) {
      throw new NotFoundException('Patient profile not found');
    }
    return profile;
  }

  async update(userId: string, dto: UpdatePatientProfileDto): Promise<PatientProfile> {
    const profile = await this.findOne(userId);
    Object.assign(profile, dto);
    return this.patientRepository.save(profile);
  }
}
