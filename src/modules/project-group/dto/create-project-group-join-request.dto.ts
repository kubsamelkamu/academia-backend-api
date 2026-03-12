import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateProjectGroupJoinRequestDto {
  @ApiPropertyOptional({ description: 'Optional message to the group leader', maxLength: 1000 })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null ? undefined : String(value).trim()
  )
  @IsString()
  @MaxLength(1000)
  message?: string;
}
