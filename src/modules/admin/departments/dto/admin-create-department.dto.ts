import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class AdminCreateDepartmentDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(20)
  code!: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  headOfDepartmentId?: string;
}
