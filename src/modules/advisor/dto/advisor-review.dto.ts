import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsString, IsOptional, IsEnum, IsInt, Min, Max, IsNotEmpty } from 'class-validator';

export enum ReviewStatus {
  REVIEWED = 'REVIEWED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  REVISION_REQUESTED = 'REVISION_REQUESTED',
}

export class CreateReviewDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  milestoneId: string;

  @ApiProperty({ enum: ReviewStatus })
  @IsEnum(ReviewStatus)
  status: ReviewStatus;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  feedback?: string;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  qualityScore?: number;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  completenessScore?: number;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  timelinessScore?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  strengths?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  weaknesses?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  recommendations?: string;
}

export class UpdateReviewDto {
  @ApiProperty({ enum: ReviewStatus })
  @IsEnum(ReviewStatus)
  @IsOptional()
  status?: ReviewStatus;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  feedback?: string;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  qualityScore?: number;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  completenessScore?: number;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  timelinessScore?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  strengths?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  weaknesses?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  recommendations?: string;
}

export class ReviewResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  milestoneId: string;

  @ApiProperty()
  milestoneTitle: string;

  @ApiProperty()
  projectId: string;

  @ApiProperty()
  projectTitle: string;

  @ApiProperty()
  advisorId: string;

  @ApiProperty()
  advisorName: string;

  @ApiProperty({ enum: ReviewStatus })
  status: ReviewStatus;

  @ApiPropertyOptional()
  feedback?: string;

  @ApiPropertyOptional()
  qualityScore?: number;

  @ApiPropertyOptional()
  completenessScore?: number;

  @ApiPropertyOptional()
  timelinessScore?: number;

  @ApiPropertyOptional()
  strengths?: string;

  @ApiPropertyOptional()
  weaknesses?: string;

  @ApiPropertyOptional()
  recommendations?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional()
  studentNames?: string[];
}
