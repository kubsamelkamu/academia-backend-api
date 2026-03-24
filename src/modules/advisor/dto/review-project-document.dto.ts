import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

const trimOptional = ({ value }: { value: unknown }) => {
  const normalized = String(value ?? '').trim();
  return normalized === '' ? undefined : normalized;
};

export class ReviewProjectDocumentDto {
  @ApiPropertyOptional({ description: 'Optional review feedback', maxLength: 5000 })
  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  feedback?: string;
}
