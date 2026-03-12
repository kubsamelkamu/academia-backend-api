import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class DecideProjectGroupReviewDto {
  @ApiPropertyOptional({ description: 'Optional reason (used on rejection)', maxLength: 500 })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null ? undefined : String(value).trim()
  )
  @IsString()
  @MaxLength(500)
  reason?: string;
}
