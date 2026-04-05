import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export const PROJECT_GROUP_REVIEW_FILTERS = ['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const;

export type ProjectGroupReviewFilter = (typeof PROJECT_GROUP_REVIEW_FILTERS)[number];

export class ListSubmittedProjectGroupsQueryDto {
  @ApiPropertyOptional({
    enum: PROJECT_GROUP_REVIEW_FILTERS,
    default: 'ALL',
    description:
      'Review status filter. PENDING maps to submitted groups waiting for department review.',
  })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null ? undefined : String(value).trim().toUpperCase()
  )
  @IsIn(PROJECT_GROUP_REVIEW_FILTERS)
  status?: ProjectGroupReviewFilter;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: 'Search groups by name' })
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null ? undefined : String(value).trim()
  )
  @IsString()
  search?: string;
}
