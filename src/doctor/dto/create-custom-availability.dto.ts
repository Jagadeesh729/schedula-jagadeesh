import { IsNotEmpty, IsString, Matches } from 'class-validator';

const TIME_FORMAT = /^([0-1]\d|2[0-3]):[0-5]\d$/;
const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

export class CreateCustomAvailabilityDto {
  @IsString()
  @IsNotEmpty()
  @Matches(DATE_FORMAT, { message: 'date must be in YYYY-MM-DD format' })
  date!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(TIME_FORMAT, { message: 'startTime must be in HH:MM 24-hour format' })
  startTime!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(TIME_FORMAT, { message: 'endTime must be in HH:MM 24-hour format' })
  endTime!: string;
}
