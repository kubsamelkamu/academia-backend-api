import { ProjectGroupStatus, ProjectStatus, MilestoneStatus, UserStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AdvisorAnalyticsStudentProfileDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional({ nullable: true })
  bio?: string | null;

  @ApiPropertyOptional({ nullable: true })
  githubUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  linkedinUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  portfolioUrl?: string | null;

  @ApiPropertyOptional({ nullable: true, type: 'object', additionalProperties: true })
  techStack?: Record<string, unknown> | null;
}

export class AdvisorAnalyticsPersonDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty()
  email: string;

  @ApiPropertyOptional({ nullable: true })
  avatarUrl?: string | null;

  @ApiPropertyOptional({ type: () => AdvisorAnalyticsStudentProfileDto, nullable: true })
  studentProfile?: AdvisorAnalyticsStudentProfileDto | null;
}

export class AdvisorAnalyticsMilestoneDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional({ nullable: true })
  description?: string | null;

  @ApiProperty({ enum: MilestoneStatus })
  status: MilestoneStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  dueDate: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  submittedAt?: Date | null;

  @ApiPropertyOptional({ nullable: true })
  feedback?: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;
}

export class AdvisorAnalyticsProjectProgressDto {
  @ApiProperty()
  percentage: number;

  @ApiProperty()
  approvedMilestones: number;

  @ApiProperty()
  submittedMilestones: number;

  @ApiProperty()
  rejectedMilestones: number;

  @ApiProperty()
  pendingMilestones: number;

  @ApiProperty()
  totalMilestones: number;
}

export class AdvisorAnalyticsProposalDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;
}

export class AdvisorAnalyticsGroupDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ enum: ProjectGroupStatus })
  status: ProjectGroupStatus;

  @ApiPropertyOptional({ nullable: true })
  objectives?: string | null;

  @ApiPropertyOptional({ nullable: true, type: 'object', additionalProperties: true })
  technologies?: Record<string, unknown> | null;

  @ApiPropertyOptional({ type: () => AdvisorAnalyticsPersonDto, nullable: true })
  leader?: AdvisorAnalyticsPersonDto | null;

  @ApiProperty({ type: () => [AdvisorAnalyticsPersonDto] })
  members: AdvisorAnalyticsPersonDto[];

  @ApiProperty()
  totalMembers: number;
}

export class AdvisorAnalyticsProjectDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional({ nullable: true })
  description?: string | null;

  @ApiProperty({ enum: ProjectStatus })
  status: ProjectStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;

  @ApiPropertyOptional({ type: () => AdvisorAnalyticsPersonDto, nullable: true })
  advisor?: AdvisorAnalyticsPersonDto | null;

  @ApiPropertyOptional({ type: () => AdvisorAnalyticsProposalDto, nullable: true })
  proposal?: AdvisorAnalyticsProposalDto | null;

  @ApiProperty({ type: () => AdvisorAnalyticsProjectProgressDto })
  progress: AdvisorAnalyticsProjectProgressDto;

  @ApiProperty({ type: () => [AdvisorAnalyticsMilestoneDto] })
  milestones: AdvisorAnalyticsMilestoneDto[];

  @ApiPropertyOptional({ type: () => AdvisorAnalyticsGroupDto, nullable: true })
  group?: AdvisorAnalyticsGroupDto | null;
}

export class AdvisorAnalyticsAdvisorMetricsDto {
  @ApiProperty()
  totalProjectsAdvising: number;

  @ApiProperty()
  activeProjectsCount: number;

  @ApiProperty()
  completedProjectsCount: number;

  @ApiProperty()
  cancelledProjectsCount: number;

  @ApiProperty()
  overallProjectProgress: number;
}

export class AdvisorAnalyticsAdvisorDto {
  @ApiProperty()
  advisorProfileId: string;

  @ApiProperty()
  advisorId: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty()
  email: string;

  @ApiPropertyOptional({ nullable: true })
  avatarUrl?: string | null;

  @ApiProperty({ enum: UserStatus })
  status: UserStatus;

  @ApiProperty()
  loadLimit: number;

  @ApiProperty()
  currentLoad: number;

  @ApiProperty()
  availableCapacity: number;

  @ApiProperty({ type: () => AdvisorAnalyticsAdvisorMetricsDto })
  metrics: AdvisorAnalyticsAdvisorMetricsDto;

  @ApiProperty({ type: () => [AdvisorAnalyticsProjectDto] })
  projects: AdvisorAnalyticsProjectDto[];
}

export class AdvisorAnalyticsProjectStatusCountsDto {
  @ApiProperty()
  ACTIVE: number;

  @ApiProperty()
  COMPLETED: number;

  @ApiProperty()
  CANCELLED: number;
}

export class AdvisorAnalyticsSummaryDto {
  @ApiProperty()
  totalAdvisors: number;

  @ApiProperty()
  totalProjects: number;

  @ApiProperty()
  assignedProjects: number;

  @ApiProperty()
  unassignedProjects: number;

  @ApiProperty()
  overallDepartmentProjectProgress: number;

  @ApiProperty({ type: () => AdvisorAnalyticsProjectStatusCountsDto })
  projectStatusCounts: AdvisorAnalyticsProjectStatusCountsDto;
}

export class AdvisorAnalyticsPaginationDto {
  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalItems: number;

  @ApiProperty()
  totalPages: number;

  @ApiProperty()
  hasNextPage: boolean;

  @ApiProperty()
  hasPreviousPage: boolean;
}

export class AdvisorAnalyticsFiltersDto {
  @ApiPropertyOptional({ nullable: true })
  search?: string | null;

  @ApiPropertyOptional({ enum: ProjectStatus, nullable: true })
  projectStatus?: ProjectStatus | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  startDate?: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  endDate?: string | null;
}

export class AdvisorOverviewResponseDto {
  @ApiProperty()
  departmentId: string;

  @ApiProperty({ type: String, format: 'date-time' })
  generatedAt: string;

  @ApiProperty({ type: () => AdvisorAnalyticsSummaryDto })
  summary: AdvisorAnalyticsSummaryDto;

  @ApiProperty({ type: () => AdvisorAnalyticsPaginationDto })
  pagination: AdvisorAnalyticsPaginationDto;

  @ApiProperty({ type: () => AdvisorAnalyticsFiltersDto })
  filters: AdvisorAnalyticsFiltersDto;

  @ApiProperty({ type: () => [AdvisorAnalyticsAdvisorDto] })
  advisors: AdvisorAnalyticsAdvisorDto[];
}

export class AdvisorDetailResponseDto {
  @ApiProperty()
  departmentId: string;

  @ApiProperty({ type: String, format: 'date-time' })
  generatedAt: string;

  @ApiProperty({ type: () => AdvisorAnalyticsSummaryDto })
  summary: AdvisorAnalyticsSummaryDto;

  @ApiProperty({ type: () => AdvisorAnalyticsAdvisorDto })
  advisor: AdvisorAnalyticsAdvisorDto;
}