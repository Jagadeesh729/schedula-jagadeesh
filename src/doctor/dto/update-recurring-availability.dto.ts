import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { Weekday } from '../enums/weekday.enum';

const TIME_FORMAT = /^([0-1]\d|2[0-3]):[0-5]\d$/;

export class UpdateRecurringAvailabilityDto {
  @IsEnum(Weekday, { message: 'weekday must be one of: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday' })
  @IsOptional()
  weekday?: Weekday;

  @IsString()
  @IsOptional()
  @Matches(TIME_FORMAT, { message: 'startTime must be in HH:MM 24-hour format' })
  startTime?: string;

  @IsString()
  @IsOptional()
  @Matches(TIME_FORMAT, { message: 'endTime must be in HH:MM 24-hour format' })
  endTime?: string;
}

