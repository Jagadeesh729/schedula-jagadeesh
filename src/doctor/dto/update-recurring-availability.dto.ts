import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { Weekday } from '../enums/weekday.enum';

const TIME_FORMAT = /^([0-1]\d|2[0-3]):[0-5]\d$/;

export class UpdateRecurringAvailabilityDto {
  @ApiPropertyOptional({
    enum: Weekday,
    example: Weekday.Monday,
    description: 'Updated day of week',
  })
  @IsEnum(Weekday, {
    message:
      'weekday must be one of: Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday',
  })
  @IsOptional()
  weekday?: Weekday;

  @ApiPropertyOptional({
    example: '10:00',
    description: 'Updated start time in HH:MM format',
  })
  @IsString()
  @IsOptional()
  @Matches(TIME_FORMAT, {
    message: 'startTime must be in HH:MM 24-hour format',
  })
  startTime?: string;

  @ApiPropertyOptional({
    example: '16:00',
    description: 'Updated end time in HH:MM format',
  })
  @IsString()
  @IsOptional()
  @Matches(TIME_FORMAT, { message: 'endTime must be in HH:MM 24-hour format' })
  endTime?: string;
}
