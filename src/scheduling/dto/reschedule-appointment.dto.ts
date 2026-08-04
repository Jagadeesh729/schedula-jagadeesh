import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { SchedulingType } from '../enums/scheduling-type.enum';
import { SlotDto } from './scheduling.dto';

export class RescheduleAppointmentDto {
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date!: string;

  @IsOptional()
  @IsEnum(SchedulingType)
  scheduleType?: SchedulingType;

  @IsOptional()
  @ValidateNested()
  @Type(() => SlotDto)
  slot?: SlotDto;

  @IsOptional()
  @IsString()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'startTime must be HH:MM format',
  })
  startTime?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'endTime must be HH:MM format',
  })
  endTime?: string;

  @IsOptional()
  @IsString()
  window?: string;
}
