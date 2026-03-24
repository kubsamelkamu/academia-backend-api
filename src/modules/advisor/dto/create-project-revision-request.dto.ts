import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => String(value ?? '').trim();
const trimOptional = ({ value }: { value: unknown }) => {
  const normalized = String(value ?? '').trim();
  return normalized === '' ? undefined : normalized;
};

export class CreateProjectRevisionRequestDto {
  @ApiProperty({ description: 'Revision request subject' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  subject!: string;

  @ApiProperty({ description: 'Revision feedback details' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  feedback!: string;

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
