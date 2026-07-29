import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { SchedulingType } from '../enums/scheduling-type.enum';

export class SlotDto {
  @IsNotEmpty()
  @IsString()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'startTime must be HH:MM format',
  })
  startTime!: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'endTime must be HH:MM format',
  })
  endTime!: string;
}

export class CreateSchedulingConfigDto {
  @IsNotEmpty()
  @IsEnum(SchedulingType)
  schedulingType!: SchedulingType;

  @IsOptional()
  @IsInt()
  @Min(1)
  slotDuration?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  bufferTime?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxCapacity?: number;
}

export class CreateAppointmentDto {
  @IsNotEmpty()
  @IsUUID()
  doctorId!: string;

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
