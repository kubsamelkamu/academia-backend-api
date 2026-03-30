import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => String(value ?? '').trim();
const trimOptional = ({ value }: { value: unknown }) => {
  const normalized = String(value ?? '').trim();
  return normalized === '' ? undefined : normalized;
};

export class CreateProjectDocumentDto {
  @ApiProperty({ description: 'Project id that owns the document' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  projectId!: string;

  @ApiPropertyOptional({ description: 'Optional milestone id linked to the document' })
  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  milestoneId?: string;

  @ApiPropertyOptional({ description: 'Optional document description', maxLength: 5000 })
  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;
}
