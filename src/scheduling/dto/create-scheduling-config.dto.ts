import { IsEnum, IsInt, Min, IsOptional, ValidateIf } from 'class-validator';
import { SchedulingType } from '../enums/scheduling-type.enum';

export class CreateSchedulingConfigDto {
  @IsEnum(SchedulingType, { message: 'Invalid scheduling type' })
  schedulingType!: SchedulingType;

  @ValidateIf(
    (o: { schedulingType?: SchedulingType }) =>
      o.schedulingType === SchedulingType.STREAM,
  )
  @IsInt({ message: 'slotDuration must be an integer' })
  @Min(1, { message: 'slotDuration must be greater than 0' })
  @IsOptional()
  slotDuration?: number;

  @ValidateIf(
    (o: { schedulingType?: SchedulingType }) =>
      o.schedulingType === SchedulingType.STREAM,
  )
  @IsInt({ message: 'bufferTime must be an integer' })
  @Min(0, { message: 'bufferTime cannot be negative' })
  @IsOptional()
  bufferTime?: number;

  @ValidateIf(
    (o: { schedulingType?: SchedulingType }) =>
      o.schedulingType === SchedulingType.WAVE,
  )
  @IsInt({ message: 'maxCapacity must be an integer' })
  @Min(1, { message: 'maxCapacity must be greater than 0' })
  @IsOptional()
  maxCapacity?: number;
}
