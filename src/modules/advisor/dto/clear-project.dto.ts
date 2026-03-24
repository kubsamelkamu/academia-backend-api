import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

const trimOptional = ({ value }: { value: unknown }) => {
  const normalized = String(value ?? '').trim();
  return normalized === '' ? undefined : normalized;
};

export class ClearProjectDto {
  @ApiPropertyOptional({ description: 'Optional clearance notes', maxLength: 5000 })
  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;
}
