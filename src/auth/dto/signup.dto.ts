import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  MinLength,
} from 'class-validator';

export class SignupDto {
  @ApiProperty({ example: 'Dr. John Doe', description: 'Full user name' })
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  name: string;

  @ApiProperty({
    example: 'doctor@hospital.com',
    description: 'Unique user email address',
  })
  @IsEmail({}, { message: 'Invalid email address' })
  email: string;

  @ApiProperty({
    example: 'Password123!',
    minLength: 6,
    description: 'User password (minimum 6 characters)',
  })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;

  @ApiProperty({
    enum: ['DOCTOR', 'PATIENT'],
    example: 'DOCTOR',
    description: 'User role in Schedula system',
  })
  @IsString()
  @IsIn(['DOCTOR', 'PATIENT'], {
    message: 'Role must be either DOCTOR or PATIENT',
  })
  role: string;
}
