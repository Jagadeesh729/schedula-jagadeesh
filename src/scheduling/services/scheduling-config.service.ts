import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SchedulingConfig } from '../entities/scheduling-config.entity';
import { DoctorProfile } from '../../doctor/entities/doctor-profile.entity';
import { CreateSchedulingConfigDto } from '../dto/scheduling.dto';
import { SchedulingType } from '../enums/scheduling-type.enum';

@Injectable()
export class SchedulingConfigService {
  constructor(
    @InjectRepository(SchedulingConfig)
    private readonly configRepo: Repository<SchedulingConfig>,
    @InjectRepository(DoctorProfile)
    private readonly doctorProfileRepo: Repository<DoctorProfile>,
  ) {}

  async createOrUpdateConfig(
    doctorIdOrUserId: string,
    dto: CreateSchedulingConfigDto,
    currentUser: { id: string; role: string },
  ): Promise<SchedulingConfig> {
    const doctor = await this.doctorProfileRepo.findOne({
      where: [{ id: doctorIdOrUserId }, { user: { id: doctorIdOrUserId } }],
      relations: { user: true },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor profile not found');
    }

    if (currentUser.role !== 'ADMIN' && doctor.user.id !== currentUser.id) {
      throw new ForbiddenException(
        'You are not authorized to configure scheduling for this doctor',
      );
    }

    if (dto.schedulingType === SchedulingType.STREAM) {
      if (!dto.slotDuration || dto.slotDuration <= 0) {
        throw new BadRequestException(
          'slotDuration must be greater than 0 for STREAM scheduling',
        );
      }
    } else if (dto.schedulingType === SchedulingType.WAVE) {
      if (!dto.maxCapacity || dto.maxCapacity <= 0) {
        throw new BadRequestException(
          'maxCapacity must be greater than 0 for WAVE scheduling',
        );
      }
    }

    let config = await this.configRepo.findOne({
      where: { doctorId: doctor.id },
    });

    if (config) {
      config.schedulingType = dto.schedulingType;
      config.slotDuration = dto.slotDuration;
      config.bufferTime = dto.bufferTime ?? 0;
      config.maxCapacity = dto.maxCapacity;
    } else {
      config = this.configRepo.create({
        doctorId: doctor.id,
        schedulingType: dto.schedulingType,
        slotDuration: dto.slotDuration,
        bufferTime: dto.bufferTime ?? 0,
        maxCapacity: dto.maxCapacity,
      });
    }

    return await this.configRepo.save(config);
  }
}
