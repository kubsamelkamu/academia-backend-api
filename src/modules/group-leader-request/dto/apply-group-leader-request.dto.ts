import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ApplyGroupLeaderRequestDto {
  @ApiPropertyOptional({
    description: 'Optional message from the student to the department head',
    maxLength: 1000,
    example: 'I would like to lead a group because I have prior project experience and can coordinate tasks.',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null) return undefined;
    const v = String(value).trim();
    return v.length ? v : undefined;
  })
  @IsString()
  @MaxLength(1000)
  message?: string;

  @ApiPropertyOptional({
    description: 'Deprecated alias for message (kept for backward compatibility)',
    maxLength: 1000,
    deprecated: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null) return undefined;
    const v = String(value).trim();
    return v.length ? v : undefined;
  })
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
