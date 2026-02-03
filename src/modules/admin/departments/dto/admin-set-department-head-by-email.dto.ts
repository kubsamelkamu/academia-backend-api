import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AdminSetDepartmentHeadByEmailDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  fullName?: string;
}
