import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, Matches } from 'class-validator';
import { Weekday } from '../enums/weekday.enum';

const TIME_FORMAT = /^([0-1]\d|2[0-3]):[0-5]\d$/;

export class CreateRecurringAvailabilityDto {
  @ApiProperty({
    enum: Weekday,
    example: Weekday.Monday,
    description: 'Day of week for recurring availability (e.g. Monday)',
  })
  @IsEnum(Weekday, {
    message:
      'weekday must be one of: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday',
  })
  @IsNotEmpty()
  weekday: Weekday;

  @ApiProperty({
    example: '09:00',
    description: 'Start time in 24-hour HH:MM format',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(TIME_FORMAT, {
    message: 'startTime must be in HH:MM 24-hour format',
  })
  startTime: string;

  @ApiProperty({
    example: '17:00',
    description: 'End time in 24-hour HH:MM format',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(TIME_FORMAT, { message: 'endTime must be in HH:MM 24-hour format' })
  endTime: string;
}
