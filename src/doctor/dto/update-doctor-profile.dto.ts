import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateDoctorProfileDto {
  @IsString()
  @IsOptional()
  fullName?: string;

  @IsString()
  @IsOptional()
  specialization?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  experience?: number;

  @IsString()
  @IsOptional()
  qualification?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  consultationFee?: number;

  @IsString()
  @IsOptional()
  availability?: string;

  @IsString()
  @IsOptional()
  profileDetails?: string;
}
