import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

const trimOptional = ({ value }: { value: unknown }) => {
  const normalized = String(value ?? '').trim();
  return normalized === '' ? undefined : normalized;
};

export class CreateProjectRevisionRequestDto {
  @ApiPropertyOptional({ description: 'Revision request subject' })
  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  subject?: string;

  @ApiPropertyOptional({ description: 'Revision feedback details' })
  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  feedback?: string;

  @ApiPropertyOptional({ description: 'Optional milestone id' })
  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  milestoneId?: string;

  @ApiPropertyOptional({ description: 'Optional document id' })
  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  documentId?: string;

  @ApiPropertyOptional({ description: 'Optional evaluation id' })
  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  evaluationId?: string;
}
