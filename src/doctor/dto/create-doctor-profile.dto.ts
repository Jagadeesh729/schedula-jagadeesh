import { IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class CreateDoctorProfileDto {
  @IsString()
  @IsNotEmpty({ message: 'Full name is required' })
  fullName: string;

  @IsString()
  @IsNotEmpty({ message: 'Specialization is required' })
  specialization: string;

  @IsNumber()
  @Min(0, { message: 'Experience must be a positive number' })
  experience: number;

  @IsString()
  @IsNotEmpty({ message: 'Qualification is required' })
  qualification: string;

  @IsNumber()
  @Min(0, { message: 'Consultation fee must be a positive number' })
  consultationFee: number;

  @IsString()
  @IsNotEmpty({ message: 'Availability is required' })
  availability: string;

  @IsString()
  @IsNotEmpty({ message: 'Profile details are required' })
  profileDetails: string;
}
