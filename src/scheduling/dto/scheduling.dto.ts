import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiProperty({
    example: '09:00',
    description: 'Slot start time in HH:MM format',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'startTime must be HH:MM format',
  })
  startTime!: string;

  @ApiProperty({
    example: '09:15',
    description: 'Slot end time in HH:MM format',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'endTime must be HH:MM format',
  })
  endTime!: string;
}

export class CreateSchedulingConfigDto {
  @ApiProperty({
    enum: SchedulingType,
    example: SchedulingType.STREAM,
    description: 'Scheduling strategy: STREAM (slots) or WAVE (windows)',
  })
  @IsNotEmpty()
  @IsEnum(SchedulingType)
  schedulingType!: SchedulingType;

  @ApiPropertyOptional({
    example: 15,
    description: 'STREAM slot duration in minutes (required for STREAM)',
    type: Number,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  slotDuration?: number;

  @ApiPropertyOptional({
    example: 5,
    description: 'STREAM buffer time in minutes between slots',
    type: Number,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  bufferTime?: number;

  @ApiPropertyOptional({
    example: 5,
    description:
      'WAVE maximum patient token capacity per window (required for WAVE)',
    type: Number,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxCapacity?: number;
}

export class CreateAppointmentDto {
  @ApiProperty({
    example: '6fe2ec51-5f13-4731-92da-64f97c58de9f',
    description: 'Target Doctor User ID (UUID)',
  })
  @IsNotEmpty()
  @IsUUID()
  doctorId!: string;

  @ApiProperty({
    example: '2026-08-20',
    description: 'Appointment date in YYYY-MM-DD format',
  })
  @IsNotEmpty()
  @IsString()
  @IsDateString(
    {},
    { message: 'date must be a valid calendar date in YYYY-MM-DD format' },
  )
  date!: string;

  @ApiPropertyOptional({
    enum: SchedulingType,
    example: SchedulingType.STREAM,
    description: 'Optional explicit schedule type override',
  })
  @IsOptional()
  @IsEnum(SchedulingType)
  scheduleType?: SchedulingType;

  @ApiPropertyOptional({
    type: SlotDto,
    description: 'Nested slot object for STREAM scheduling',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => SlotDto)
  slot?: SlotDto;

  @ApiPropertyOptional({
    example: '09:00',
    description: 'Top-level slot start time in HH:MM format',
  })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'startTime must be HH:MM format',
  })
  startTime?: string;

  @ApiPropertyOptional({
    example: '09:15',
    description: 'Top-level slot end time in HH:MM format',
  })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'endTime must be HH:MM format',
  })
  endTime?: string;

  @ApiPropertyOptional({
    example: '09:00 - 10:00',
    description: 'Window interval for WAVE scheduling',
  })
  @IsOptional()
  @IsString()
  window?: string;

  @ApiPropertyOptional({
    example: 15,
    description: 'Custom duration minutes',
    type: Number,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutes?: number;
}

export class RescheduleAppointmentDto {
  @ApiProperty({
    example: '2026-08-22',
    description: 'New desired appointment date in YYYY-MM-DD format',
  })
  @IsNotEmpty()
  @IsString()
  @IsDateString(
    {},
    { message: 'date must be a valid calendar date in YYYY-MM-DD format' },
  )
  date!: string;

  @ApiPropertyOptional({
    enum: SchedulingType,
    example: SchedulingType.STREAM,
    description: 'Schedule type',
  })
  @IsOptional()
  @IsEnum(SchedulingType)
  scheduleType?: SchedulingType;

  @ApiPropertyOptional({
    type: SlotDto,
    description: 'New slot object for STREAM rescheduling',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => SlotDto)
  slot?: SlotDto;

  @ApiPropertyOptional({
    example: '10:00',
    description: 'New slot start time in HH:MM format',
  })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'startTime must be HH:MM format',
  })
  startTime?: string;

  @ApiPropertyOptional({
    example: '10:15',
    description: 'New slot end time in HH:MM format',
  })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'endTime must be HH:MM format',
  })
  endTime?: string;

  @ApiPropertyOptional({
    example: '10:00 - 11:00',
    description: 'New window interval for WAVE rescheduling',
  })
  @IsOptional()
  @IsString()
  window?: string;
}
