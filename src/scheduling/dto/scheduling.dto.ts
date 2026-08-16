import { Type } from 'class-transformer';
import {
  IsDateString,
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

import { ApiProperty } from '@nestjs/swagger';

export class CreateSchedulingConfigDto {
  @ApiProperty({
    enum: SchedulingType,
    example: SchedulingType.STREAM,
    description: 'Scheduling strategy: STREAM (slots) or WAVE (windows)',
  })
  @IsNotEmpty()
  @IsEnum(SchedulingType)
  schedulingType!: SchedulingType;

  @ApiProperty({
    example: 15,
    required: false,
    description: 'STREAM slot duration in minutes (required for STREAM)',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  slotDuration?: number;

  @ApiProperty({
    example: 5,
    required: false,
    description: 'STREAM buffer time in minutes between slots',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  bufferTime?: number;

  @ApiProperty({
    example: 5,
    required: false,
    description:
      'WAVE maximum patient token capacity per window (required for WAVE)',
  })
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
  @IsDateString(
    {},
    { message: 'date must be a valid calendar date in YYYY-MM-DD format' },
  )
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

  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutes?: number;
}

export class RescheduleAppointmentDto {
  @IsNotEmpty()
  @IsString()
  @IsDateString(
    {},
    { message: 'date must be a valid calendar date in YYYY-MM-DD format' },
  )
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
