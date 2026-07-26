import { ForbiddenException } from '@nestjs/common';
import { SchedulingConfigService } from './scheduling-config.service';

describe('SchedulingConfigService', () => {
  it('rejects a doctor trying to configure another doctor profile', async () => {
    const configRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    const doctorProfileRepo = {
      findOne: jest.fn(),
    };

    const service = new SchedulingConfigService(
      configRepo as any,
      doctorProfileRepo as any,
    );

    doctorProfileRepo.findOne.mockResolvedValueOnce({ id: 'doctor-a', user: { id: 'user-a' } });
    doctorProfileRepo.findOne.mockResolvedValueOnce({ id: 'doctor-b', user: { id: 'user-b' } });

    await expect(
      service.configureScheduling('doctor-b', { schedulingType: 'STREAM', slotDuration: 15 }, 'user-a'),
    ).rejects.toThrow(ForbiddenException);
  });
});
