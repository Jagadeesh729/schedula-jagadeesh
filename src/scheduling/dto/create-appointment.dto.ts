import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SchedulingType } from '../enums/scheduling-type.enum';

export class SlotDto {
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'startTime must be in HH:MM format' })
  startTime!: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'endTime must be in HH:MM format' })
  endTime!: string;
}

export class CreateAppointmentDto {
  @IsUUID('4', { message: 'Invalid doctorId UUID' })
  @IsNotEmpty()
  doctorId!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be in YYYY-MM-DD format' })
  date!: string;

  @IsOptional()
  @IsEnum(SchedulingType, { message: 'Invalid scheduleType' })
  scheduleType?: SchedulingType;

  // STREAM scheduling slot
  @IsOptional()
  @ValidateNested()
  @Type(() => SlotDto)
  slot?: SlotDto;

  // WAVE scheduling window (e.g. "10:00-11:00")
  @IsOptional()
  @IsString()
  window?: string;

  @IsOptional()
  @IsUUID('4', { message: 'Invalid patientId UUID' })
  patientId?: string;
}
