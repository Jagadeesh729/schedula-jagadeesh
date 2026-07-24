import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SchedulingConfig } from '../entities/scheduling-config.entity';
import { DoctorProfile } from '../../doctor/entities/doctor-profile.entity';
import { SchedulingType } from '../enums/scheduling-type.enum';
import { CreateSchedulingConfigDto } from '../dto/create-scheduling-config.dto';

@Injectable()
export class SchedulingConfigService {
  constructor(
    @InjectRepository(SchedulingConfig)
    private readonly configRepo: Repository<SchedulingConfig>,
    @InjectRepository(DoctorProfile)
    private readonly doctorProfileRepo: Repository<DoctorProfile>,
  ) {}

  async resolveDoctorProfile(doctorIdOrUserId: string): Promise<DoctorProfile> {
    let profile = await this.doctorProfileRepo.findOne({
      where: { id: doctorIdOrUserId },
    });
    if (!profile) {
      profile = await this.doctorProfileRepo.findOne({
        where: { user: { id: doctorIdOrUserId } },
      });
    }
    if (!profile) {
      throw new NotFoundException('Doctor profile not found');
    }
    return profile;
  }

  async configureScheduling(
    doctorIdOrUserId: string,
    dto: CreateSchedulingConfigDto,
  ): Promise<SchedulingConfig> {
    const doctor = await this.resolveDoctorProfile(doctorIdOrUserId);

    if (dto.schedulingType === SchedulingType.STREAM) {
      if (dto.slotDuration === undefined || dto.slotDuration === null || dto.slotDuration <= 0) {
        throw new BadRequestException('invalid slot duration');
      }
      if (dto.bufferTime !== undefined && dto.bufferTime !== null && dto.bufferTime < 0) {
        throw new BadRequestException('negative buffer');
      }
    } else if (dto.schedulingType === SchedulingType.WAVE) {
      if (dto.maxCapacity === undefined || dto.maxCapacity === null || dto.maxCapacity <= 0) {
        throw new BadRequestException('capacity <= 0');
      }
    } else {
      throw new BadRequestException('invalid scheduling type');
    }

    let config = await this.configRepo.findOne({
      where: { doctorId: doctor.id },
    });

    if (config) {
      config.schedulingType = dto.schedulingType;
      config.slotDuration = dto.schedulingType === SchedulingType.STREAM ? dto.slotDuration! : null;
      config.bufferTime = dto.schedulingType === SchedulingType.STREAM ? (dto.bufferTime ?? 0) : null;
      config.maxCapacity = dto.schedulingType === SchedulingType.WAVE ? dto.maxCapacity! : null;
    } else {
      config = this.configRepo.create({
        doctor,
        doctorId: doctor.id,
        schedulingType: dto.schedulingType,
        slotDuration: dto.schedulingType === SchedulingType.STREAM ? dto.slotDuration! : null,
        bufferTime: dto.schedulingType === SchedulingType.STREAM ? (dto.bufferTime ?? 0) : null,
        maxCapacity: dto.schedulingType === SchedulingType.WAVE ? dto.maxCapacity! : null,
      });
    }

    return await this.configRepo.save(config);
  }

  async getConfigByDoctorId(doctorIdOrUserId: string): Promise<SchedulingConfig> {
    const doctor = await this.resolveDoctorProfile(doctorIdOrUserId);
    const config = await this.configRepo.findOne({
      where: { doctorId: doctor.id },
    });
    if (!config) {
      throw new NotFoundException('Doctor scheduling configuration not found');
    }
    return config;
  }
}
