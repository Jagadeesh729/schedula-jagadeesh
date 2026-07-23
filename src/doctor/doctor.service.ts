import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DoctorProfile } from './entities/doctor-profile.entity';
import { CreateDoctorProfileDto } from './dto/create-doctor-profile.dto';
import { UpdateDoctorProfileDto } from './dto/update-doctor-profile.dto';
import { User } from '../users/entities/user.entity';

@Injectable()
export class DoctorService {
  constructor(
    @InjectRepository(DoctorProfile)
    private readonly doctorRepository: Repository<DoctorProfile>,
  ) {}

  async create(userId: string, dto: CreateDoctorProfileDto): Promise<DoctorProfile> {
    const existing = await this.doctorRepository.findOne({
      where: { user: { id: userId } },
    });
    if (existing) {
      throw new ConflictException('Doctor profile already exists');
    }

    const profile = this.doctorRepository.create({
      ...dto,
      user: { id: userId } as User,
    });

    return this.doctorRepository.save(profile);
  }

  async findOne(userId: string): Promise<DoctorProfile> {
    const profile = await this.doctorRepository.findOne({
      where: { user: { id: userId } },
    });
    if (!profile) {
      throw new NotFoundException('Doctor profile not found');
    }
    return profile;
  }

  async update(userId: string, dto: UpdateDoctorProfileDto): Promise<DoctorProfile> {
    const profile = await this.findOne(userId);
    Object.assign(profile, dto);
    return this.doctorRepository.save(profile);
  }
}
