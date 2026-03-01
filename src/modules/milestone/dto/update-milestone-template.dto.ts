import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class UpdateMilestoneTemplateMilestoneDto {
  @ApiPropertyOptional({ description: 'Milestone sequence (1..n)', example: 1 })
  @IsInt()
  @Min(1)
  sequence: number;

  @ApiPropertyOptional({ description: 'Milestone title', example: 'Design Document' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({ description: 'Milestone description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Default duration in days', example: 14 })
  @IsInt()
  @Min(1)
  @Max(3650)
  defaultDurationDays: number;

  @ApiPropertyOptional({ description: 'Whether this milestone has a deliverable', example: true })
  @IsBoolean()
  hasDeliverable: boolean;

  @ApiPropertyOptional({ description: 'Required document filenames / labels', example: ['design_doc.pdf'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(255, { each: true })
  requiredDocuments?: string[];

  @ApiPropertyOptional({ description: 'Whether this milestone is required', default: true })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;
}

export class UpdateMilestoneTemplateDto {
  @ApiPropertyOptional({ description: 'Template name' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ description: 'Template description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Whether the template is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Optional: replace template milestones (full replacement). Provide a non-empty list.',
    type: [UpdateMilestoneTemplateMilestoneDto],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdateMilestoneTemplateMilestoneDto)
  milestones?: UpdateMilestoneTemplateMilestoneDto[];
}
