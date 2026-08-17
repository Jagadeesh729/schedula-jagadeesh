import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

const TIME_FORMAT = /^([0-1]\d|2[0-3]):[0-5]\d$/;
const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

export class CreateCustomAvailabilityDto {
  @ApiProperty({
    example: '2026-08-25',
    description: 'Specific override date in YYYY-MM-DD format',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(DATE_FORMAT, { message: 'date must be in YYYY-MM-DD format' })
  date: string;

  @ApiProperty({
    example: '14:00',
    description: 'Override start time in HH:MM format',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(TIME_FORMAT, {
    message: 'startTime must be in HH:MM 24-hour format',
  })
  startTime: string;

  @ApiProperty({
    example: '18:00',
    description: 'Override end time in HH:MM format',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(TIME_FORMAT, { message: 'endTime must be in HH:MM 24-hour format' })
  endTime: string;
}
