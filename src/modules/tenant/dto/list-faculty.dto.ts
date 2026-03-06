import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ListFacultyQueryDto {
  @ApiPropertyOptional({
    description: 'Search by email, first name, or last name',
    maxLength: 200,
    example: 'abebe',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null) return undefined;
    const v = String(value).trim();
    return v.length ? v : undefined;
  })
  @IsString()
  @MaxLength(200)
  search?: string;

  // Alias support: allow ?q=... as well.
  @ApiPropertyOptional({
    description: 'Alias for search',
    maxLength: 200,
    example: 'abebe',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null) return undefined;
    const v = String(value).trim();
    return v.length ? v : undefined;
  })
  @IsString()
  @MaxLength(200)
  q?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
