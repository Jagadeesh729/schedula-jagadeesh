import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateDoctorProfileDto {
  @ApiPropertyOptional({
    example: 'Dr. Sarah Connor',
    description: 'Doctor full name',
  })
  @IsString()
  @IsOptional()
  fullName?: string;

  @ApiPropertyOptional({
    example: 'Cardiology',
    description: 'Medical specialization',
  })
  @IsString()
  @IsOptional()
  specialization?: string;

  @ApiPropertyOptional({
    example: 12,
    description: 'Years of clinical experience',
    type: Number,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  experience?: number;

  @ApiPropertyOptional({
    example: 'MD, FACC, PhD',
    description: 'Medical qualifications',
  })
  @IsString()
  @IsOptional()
  qualification?: string;

  @ApiPropertyOptional({
    example: 175,
    description: 'Consultation fee',
    type: Number,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  consultationFee?: number;

  @ApiPropertyOptional({
    example: 'Mon-Fri 08:30-16:30',
    description: 'Availability summary',
  })
  @IsString()
  @IsOptional()
  availability?: string;

  @ApiPropertyOptional({
    example: 'Updated cardiology clinic profile description.',
    description: 'Profile details',
  })
  @IsString()
  @IsOptional()
  profileDetails?: string;
}
