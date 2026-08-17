import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreatePatientProfileDto {
  @ApiProperty({ example: 'John Connor', description: 'Patient full name' })
  @IsString()
  @IsNotEmpty({ message: 'Full name is required' })
  fullName: string;

  @ApiProperty({
    example: 28,
    description: 'Patient age in years (numeric integer)',
    type: Number,
  })
  @IsNumber()
  @Min(0, { message: 'Age must be a positive number' })
  age: number;

  @ApiProperty({
    enum: ['MALE', 'FEMALE', 'OTHER'],
    example: 'MALE',
    description: 'Patient gender',
  })
  @IsString()
  @IsNotEmpty({ message: 'Gender is required' })
  gender: string;

  @ApiProperty({
    example: '+1-555-0199',
    description: 'Contact phone number / address details',
  })
  @IsString()
  @IsNotEmpty({ message: 'Contact details are required' })
  contactDetails: string;

  @ApiPropertyOptional({
    example: 'No known chronic medical conditions or allergies.',
    description: 'Optional basic medical history',
  })
  @IsString()
  @IsOptional()
  basicHealthInformation?: string;
}
