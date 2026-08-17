import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { NotificationType } from '../enums/notification-type.enum';

export class CreateNotificationDto {
  @ApiProperty({
    example: '3c8e4d2a-1b2c-3d4e-5f6a-7b8c9d0e1f2a',
    description: 'Target Patient ID',
  })
  @IsUUID()
  @IsNotEmpty()
  patientId!: string;

  @ApiProperty({
    enum: NotificationType,
    example: NotificationType.APPOINTMENT_REMINDER,
    description: 'Notification category type',
  })
  @IsEnum(NotificationType)
  @IsNotEmpty()
  type!: NotificationType;

  @ApiProperty({
    example: 'Appointment Reminder',
    description: 'Notification title',
  })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({
    example:
      'Reminder: You have an appointment with Dr. Sarah Connor on 2026-08-20 at 09:00.',
    description: 'Notification content text',
  })
  @IsString()
  @IsNotEmpty()
  message!: string;

  @ApiPropertyOptional({
    example: '4c9e4d2a-1b2c-3d4e-5f6a-7b8c9d0e1f2b',
    description: 'Related Appointment ID',
  })
  @IsUUID()
  @IsOptional()
  appointmentId?: string;

  @ApiPropertyOptional({
    example: 'reminder_4c9e4d2a',
    description: 'Deduplication event ID',
  })
  @IsString()
  @IsOptional()
  eventId?: string;
}
