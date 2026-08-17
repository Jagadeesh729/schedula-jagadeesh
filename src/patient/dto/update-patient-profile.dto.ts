import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdatePatientProfileDto {
  @ApiPropertyOptional({
    example: 'John Connor',
    description: 'Patient full name',
  })
  @IsString()
  @IsOptional()
  fullName?: string;

  @ApiPropertyOptional({
    example: 29,
    description: 'Updated patient age',
    type: Number,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  age?: number;

  @ApiPropertyOptional({
    enum: ['MALE', 'FEMALE', 'OTHER'],
    example: 'MALE',
    description: 'Patient gender',
  })
  @IsString()
  @IsOptional()
  gender?: string;

  @ApiPropertyOptional({
    example: '+1-555-0200',
    description: 'Updated contact details',
  })
  @IsString()
  @IsOptional()
  contactDetails?: string;

  @ApiPropertyOptional({
    example: 'Updated health information.',
    description: 'Basic health info',
  })
  @IsString()
  @IsOptional()
  basicHealthInformation?: string;
}
