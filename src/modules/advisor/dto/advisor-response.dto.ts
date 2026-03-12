import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';

class UserInfoDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiPropertyOptional()
  avatarUrl?: string;

  @ApiPropertyOptional()
  phone?: string;
}

class DepartmentInfoDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  code: string;
}

class ProjectSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  membersCount: number;

  @ApiProperty()
  milestonesCount: number;

  @ApiProperty()
  completedMilestones: number;

  @ApiProperty()
  pendingEvaluations: number;

  @ApiProperty()
  progress: number;

  @ApiPropertyOptional()
  lastSubmissionDate?: Date;

  @ApiPropertyOptional()
  dueDate?: Date;
}

class EvaluationSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  projectId: string;

  @ApiProperty()
  projectTitle: string;

  @ApiPropertyOptional()
  score?: number;

  @ApiProperty()
  status: string;

  @ApiProperty()
  createdAt: Date;
}

class ReviewSummaryDto {
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
  status: string;

  @ApiProperty()
  createdAt: Date;
}

@Exclude()
export class AdvisorResponseDto {
  @Expose()
  @ApiProperty()
  id: string;

  @Expose()
  @ApiProperty()
  userId: string;

  @Expose()
  @ApiProperty()
  departmentId: string;

  @Expose()
  @ApiProperty()
  loadLimit: number;

  @Expose()
  @ApiProperty()
  currentLoad: number;

  @Expose()
  @ApiPropertyOptional()
  expertise?: string[];

  @Expose()
  @ApiPropertyOptional()
  bio?: string;

  @Expose()
  @ApiPropertyOptional()
  officeLocation?: string;

  @Expose()
  @ApiPropertyOptional()
  officeHours?: string;

  @Expose()
  @ApiProperty()
  isAvailable: boolean;

  @Expose()
  @ApiPropertyOptional()
  academicRank?: string;

  @Expose()
  @ApiPropertyOptional()
  qualifications?: string[];

  @Expose()
  @ApiPropertyOptional()
  researchInterests?: string[];

  @Expose()
  @ApiPropertyOptional()
  profileUrl?: string;

  @Expose()
  @ApiProperty()
  createdAt: Date;

  @Expose()
  @ApiProperty()
  updatedAt: Date;

  @Expose()
  @Type(() => UserInfoDto)
  @ApiProperty({ type: UserInfoDto })
  user?: UserInfoDto;

  @Expose()
  @Type(() => DepartmentInfoDto)
  @ApiProperty({ type: DepartmentInfoDto })
  department?: DepartmentInfoDto;

  @Expose()
  @Type(() => ProjectSummaryDto)
  @ApiProperty({ type: [ProjectSummaryDto] })
  projects?: ProjectSummaryDto[];

  @Expose()
  @Type(() => EvaluationSummaryDto)
  @ApiProperty({ type: [EvaluationSummaryDto] })
  recentEvaluations?: EvaluationSummaryDto[];

  @Expose()
  @Type(() => ReviewSummaryDto)
  @ApiProperty({ type: [ReviewSummaryDto] })
  recentReviews?: ReviewSummaryDto[];

  @Expose()
  @ApiProperty()
  pendingReviews?: number;

  @Expose()
  @ApiProperty()
  pendingEvaluations?: number;

  @Expose()
  @ApiProperty()
  totalEvaluations?: number;

  @Expose()
  @ApiProperty()
  averageScore?: number;

  @Expose()
  @ApiProperty()
  utilizationRate?: number;
}
