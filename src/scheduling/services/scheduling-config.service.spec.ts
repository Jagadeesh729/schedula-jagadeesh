import { ForbiddenException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { SchedulingConfigService } from './scheduling-config.service';
import { SchedulingType } from '../enums/scheduling-type.enum';
import { SchedulingConfig } from '../entities/scheduling-config.entity';
import { DoctorProfile } from '../../doctor/entities/doctor-profile.entity';

describe('SchedulingConfigService', () => {
  it('rejects a doctor trying to configure another doctor profile', async () => {
    const configRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as Repository<SchedulingConfig>;
    const doctorProfileRepo = {
      findOne: jest.fn(),
    } as unknown as Repository<DoctorProfile>;

    const service = new SchedulingConfigService(configRepo, doctorProfileRepo);

    (doctorProfileRepo.findOne as jest.Mock).mockResolvedValueOnce({
      id: 'doctor-a',
      user: { id: 'user-a' },
    });
    (doctorProfileRepo.findOne as jest.Mock).mockResolvedValueOnce({
      id: 'doctor-b',
      user: { id: 'user-b' },
    });

    await expect(
      service.configureScheduling(
        'doctor-b',
        { schedulingType: SchedulingType.STREAM, slotDuration: 15 },
        'user-a',
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});
