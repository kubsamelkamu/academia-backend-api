import { ApiProperty } from '@nestjs/swagger';

class TopAdvisorDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  projectCount: number;

  @ApiProperty()
  completionRate: number;

  @ApiProperty()
  averageScore: number;

  @ApiProperty()
  evaluationCount: number;
}

class DepartmentDistributionDto {
  @ApiProperty()
  department: string;

  @ApiProperty()
  departmentId: string;

  @ApiProperty()
  count: number;

  @ApiProperty()
  percentage: number;

  @ApiProperty()
  averageLoad: number;
}

class MonthlyActivityDto {
  @ApiProperty()
  month: string;

  @ApiProperty()
  year: number;

  @ApiProperty()
  projectsAssigned: number;

  @ApiProperty()
  evaluationsCompleted: number;

  @ApiProperty()
  reviewsCompleted: number;

  @ApiProperty()
  milestonesReviewed: number;
}

class PerformanceMetricsDto {
  @ApiProperty()
  averageEvaluationScore: number;

  @ApiProperty()
  averageReviewTime: number;

  @ApiProperty()
  onTimeCompletionRate: number;

  @ApiProperty()
  studentSatisfactionRate?: number;
}

export class AdvisorStatisticsDto {
  @ApiProperty()
  totalAdvisors: number;

  @ApiProperty()
  activeAdvisors: number;

  @ApiProperty()
  availableAdvisors: number;

  @ApiProperty()
  fullyLoadedAdvisors: number;

  @ApiProperty()
  averageLoad: number;

  @ApiProperty()
  totalCapacity: number;

  @ApiProperty()
  utilizedCapacity: number;

  @ApiProperty()
  totalProjects: number;

  @ApiProperty()
  activeProjects: number;

  @ApiProperty()
  completedProjects: number;

  @ApiProperty()
  ongoingProjects: number;

  @ApiProperty()
  pendingEvaluations: number;

  @ApiProperty()
  pendingReviews: number;

  @ApiProperty()
  totalEvaluations: number;

  @ApiProperty()
  totalReviews: number;

  @ApiProperty()
  averageProjectCompletionTime: number;

  @ApiProperty()
  averageEvaluationScore: number;

  @ApiProperty()
  onTimeSubmissionRate: number;

  @ApiProperty()
  projectSuccessRate: number;

  @ApiProperty({ type: [TopAdvisorDto] })
  topAdvisors: TopAdvisorDto[];

  @ApiProperty({ type: [DepartmentDistributionDto] })
  departmentDistribution: DepartmentDistributionDto[];

  @ApiProperty({ type: [MonthlyActivityDto] })
  monthlyActivity: MonthlyActivityDto[];

  @ApiProperty({ type: PerformanceMetricsDto })
  performanceMetrics: PerformanceMetricsDto;
}
