import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class CreateMilestoneTemplateMilestoneDto {
  @ApiProperty({ description: 'Milestone sequence (1..n)', example: 1 })
  @IsInt()
  @Min(1)
  sequence: number;

  @ApiProperty({ description: 'Milestone title', example: 'Requirements Analysis' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional({ description: 'Milestone description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Default duration in days', example: 14 })
  @IsInt()
  @Min(1)
  @Max(3650)
  defaultDurationDays: number;

  @ApiProperty({ description: 'Whether this milestone has a deliverable', example: true })
  @IsBoolean()
  hasDeliverable: boolean;

  @ApiPropertyOptional({
    description: 'Required document filenames / labels',
    example: ['srs.pdf', 'presentation.pptx'],
  })
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

export class CreateMilestoneTemplateDto {
  @ApiProperty({ description: 'Template name', example: 'Software Project Template 2024' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ description: 'Template description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ type: [CreateMilestoneTemplateMilestoneDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateMilestoneTemplateMilestoneDto)
  milestones: CreateMilestoneTemplateMilestoneDto[];

  @ApiPropertyOptional({ description: 'Whether the template is active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
