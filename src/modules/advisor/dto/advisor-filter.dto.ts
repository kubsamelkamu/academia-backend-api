import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsUUID,
  IsInt,
  Min,
  IsEnum,
  IsString,
  IsBoolean,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum AdvisorSortField {
  NAME = 'name',
  LOAD_LIMIT = 'loadLimit',
  CURRENT_LOAD = 'currentLoad',
  CREATED_AT = 'createdAt',
  PROJECT_COUNT = 'projectCount',
  AVAILABILITY = 'availability',
  EVALUATION_COUNT = 'evaluationCount',
  AVG_SCORE = 'averageScore',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class AdvisorFilterDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  excludeAdvisorId?: string;

  @ApiPropertyOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  limit?: number = 10;

  @ApiPropertyOptional({ enum: AdvisorSortField })
  @IsEnum(AdvisorSortField)
  @IsOptional()
  sortBy?: AdvisorSortField = AdvisorSortField.NAME;

  @ApiPropertyOptional({ enum: SortOrder })
  @IsEnum(SortOrder)
  @IsOptional()
  sortOrder?: SortOrder = SortOrder.ASC;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @Type(() => Boolean)
  @IsOptional()
  isAvailable?: boolean;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  minLoad?: number;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  maxLoad?: number;

  @ApiPropertyOptional()
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  expertise?: string[];

  @ApiPropertyOptional()
  @IsBoolean()
  @Type(() => Boolean)
  @IsOptional()
  hasAvailability?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  academicRank?: string;
}
