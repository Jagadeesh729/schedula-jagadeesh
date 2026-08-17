import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class CreateDoctorProfileDto {
  @ApiProperty({ example: 'Dr. Sarah Connor', description: 'Doctor full name' })
  @IsString()
  @IsNotEmpty({ message: 'Full name is required' })
  fullName: string;

  @ApiProperty({ example: 'Cardiology', description: 'Medical specialization' })
  @IsString()
  @IsNotEmpty({ message: 'Specialization is required' })
  specialization: string;

  @ApiProperty({
    example: 10,
    description: 'Years of clinical experience (numeric integer)',
    type: Number,
  })
  @IsNumber()
  @Min(0, { message: 'Experience must be a positive number' })
  experience: number;

  @ApiProperty({
    example: 'MD, FACC',
    description: 'Degrees and medical qualifications',
  })
  @IsString()
  @IsNotEmpty({ message: 'Qualification is required' })
  qualification: string;

  @ApiProperty({
    example: 150,
    description: 'Consultation fee in currency units (numeric)',
    type: Number,
  })
  @IsNumber()
  @Min(0, { message: 'Consultation fee must be a positive number' })
  consultationFee: number;

  @ApiProperty({
    example: 'Mon-Fri 09:00-17:00',
    description: 'Doctor working hours summary',
  })
  @IsString()
  @IsNotEmpty({ message: 'Availability is required' })
  availability: string;

  @ApiProperty({
    example: 'Senior Cardiologist specializing in preventive heart health.',
    description: 'Biography / clinic profile details',
  })
  @IsString()
  @IsNotEmpty({ message: 'Profile details are required' })
  profileDetails: string;
}
