import { IsEmail, IsIn, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class SignupDto {
  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  name!: string;

  @IsEmail({}, { message: 'Invalid email address' })
  email!: string;

  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password!: string;

  @IsString()
  @IsIn(['DOCTOR', 'PATIENT'], { message: 'Role must be either DOCTOR or PATIENT' })
  role!: string;
}
