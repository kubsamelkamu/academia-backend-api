import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { DocumentTemplateType } from '@prisma/client';

export class UpdateDepartmentDocumentTemplateDto {
  @ApiPropertyOptional({ enum: DocumentTemplateType })
  @IsOptional()
  @IsEnum(DocumentTemplateType)
  type?: DocumentTemplateType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value === 'boolean') return value;
    return String(value).toLowerCase() === 'true';
  })
  @IsBoolean()
  isActive?: boolean;
}
