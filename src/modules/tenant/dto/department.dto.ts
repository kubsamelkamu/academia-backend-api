import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDepartmentDto {
  @ApiProperty({
    description: 'Department name',
    example: 'Computer Science',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({
    description: 'Department code (unique identifier)',
    example: 'CS',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;

  @ApiPropertyOptional({
    description: 'Department description',
    example: 'Department of Computer Science and Engineering',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: 'Department head user ID',
    example: 'uuid-of-department-head',
  })
  @IsOptional()
  @IsString()
  headOfDepartmentId?: string;
}

export class UpdateDepartmentDto {
  @ApiPropertyOptional({
    description: 'Department name',
    example: 'Computer Science',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({
    description: 'Department code (unique identifier)',
    example: 'CS',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @ApiPropertyOptional({
    description: 'Department description',
    example: 'Department of Computer Science and Engineering',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: 'Department head user ID',
    example: 'uuid-of-department-head',
  })
  @IsOptional()
  @IsString()
  headOfDepartmentId?: string;
}
