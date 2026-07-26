import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreatePatientProfileDto {
  @IsString()
  @IsNotEmpty({ message: 'Full name is required' })
  fullName!: string;

  @IsNumber()
  @Min(0, { message: 'Age must be a positive number' })
  age!: number;

  @IsString()
  @IsNotEmpty({ message: 'Gender is required' })
  gender!: string;

  @IsString()
  @IsNotEmpty({ message: 'Contact details are required' })
  contactDetails!: string;

  @IsString()
  @IsOptional()
  basicHealthInformation?: string;
}
