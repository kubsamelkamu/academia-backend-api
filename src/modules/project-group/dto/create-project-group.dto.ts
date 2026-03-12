import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateProjectGroupDto {
  @ApiProperty({
    description: 'Group name',
    maxLength: 255,
    example: 'Team Alpha',
  })
  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiProperty({
    description: 'Group objectives (what the group intends to build/achieve)',
    maxLength: 2000,
    example: 'Build a web-based academic project collaboration platform for students and advisors.',
  })
  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  objectives!: string;

  @ApiProperty({
    description: 'Technologies the group plans to use',
    type: [String],
    example: ['NestJS', 'PostgreSQL', 'React'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @Transform(({ value }) => {
    if (!Array.isArray(value)) return value;
    const normalized = value.map((v) => String(v ?? '').trim()).filter((v) => v.length > 0);
    return normalized;
  })
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  technologies!: string[];
}
