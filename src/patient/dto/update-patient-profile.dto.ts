import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdatePatientProfileDto {
  @IsString()
  @IsOptional()
  fullName?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  age?: number;

  @IsString()
  @IsOptional()
  gender?: string;

  @IsString()
  @IsOptional()
  contactDetails?: string;

  @IsString()
  @IsOptional()
  basicHealthInformation?: string;
}
