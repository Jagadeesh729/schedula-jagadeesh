import { IsEnum, IsNotEmpty, IsString, Matches } from 'class-validator';
import { Weekday } from '../enums/weekday.enum';

const TIME_FORMAT = /^([0-1]\d|2[0-3]):[0-5]\d$/;

export class CreateRecurringAvailabilityDto {
  @IsEnum(Weekday, {
    message:
      'weekday must be one of: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday',
  })
  @IsNotEmpty()
  weekday!: Weekday;

  @IsString()
  @IsNotEmpty()
  @Matches(TIME_FORMAT, {
    message: 'startTime must be in HH:MM 24-hour format',
  })
  startTime!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(TIME_FORMAT, { message: 'endTime must be in HH:MM 24-hour format' })
  endTime!: string;
}
