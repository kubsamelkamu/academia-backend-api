import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

const trimOrNull = () =>
  Transform(({ value }) => {
    if (typeof value !== 'string') {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  });

export class UpdateStudentProfileDto {
  @ApiPropertyOptional({
    description: 'Short student bio (nullable to clear)',
    maxLength: 2000,
    example: 'Final-year CS student focused on backend systems.',
  })
  @IsOptional()
  @trimOrNull()
  @IsString()
  @MaxLength(2000)
  bio?: string | null;

  @ApiPropertyOptional({
    description: 'GitHub profile URL (nullable to clear)',
    example: 'https://github.com/username',
  })
  @IsOptional()
  @trimOrNull()
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  githubUrl?: string | null;

  @ApiPropertyOptional({
    description: 'LinkedIn profile URL (nullable to clear)',
    example: 'https://www.linkedin.com/in/username/',
  })
  @IsOptional()
  @trimOrNull()
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  linkedinUrl?: string | null;

  @ApiPropertyOptional({
    description: 'Portfolio website URL (nullable to clear)',
    example: 'https://username.dev',
  })
  @IsOptional()
  @trimOrNull()
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  portfolioUrl?: string | null;

  @ApiPropertyOptional({
    description: 'List of technologies the student works with',
    example: ['NestJS', 'PostgreSQL'],
    type: [String],
    maxItems: 50,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @Transform(({ value }) => {
    if (!Array.isArray(value)) {
      return value;
    }

    return value
      .filter((v) => typeof v === 'string')
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
  })
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  techStack?: string[];
}
