import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MilestoneStatus, ProjectGroupStatus, ProjectStatus, UserStatus } from '@prisma/client';

export class ProjectTrackingStudentProfileDto {
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

export class ProjectTrackingPersonDto {
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
}

export class ProjectTrackingStudentPersonDto extends ProjectTrackingPersonDto {
  @ApiProperty({ enum: UserStatus })
  status: UserStatus;

  @ApiPropertyOptional({ type: () => ProjectTrackingStudentProfileDto, nullable: true })
  studentProfile?: ProjectTrackingStudentProfileDto | null;
}

export class ProjectTrackingGroupMemberDto extends ProjectTrackingStudentPersonDto {
  @ApiProperty({ type: String, format: 'date-time' })
  joinedAt: Date;
}

export class ProjectTrackingApprovedByDto extends ProjectTrackingPersonDto {}

export class ProjectTrackingApprovedSubmissionFileDto {
  @ApiProperty()
  submissionId: string;

  @ApiProperty()
  fileName: string;

  @ApiProperty()
  mimeType: string;

  @ApiProperty()
  sizeBytes: number;

  @ApiProperty()
  fileUrl: string;

  @ApiProperty()
  filePublicId: string;

  @ApiProperty()
  resourceType: string;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  approvedAt?: Date | null;

  @ApiPropertyOptional({ type: () => ProjectTrackingApprovedByDto, nullable: true })
  approvedBy?: ProjectTrackingApprovedByDto | null;
}

export class ProjectTrackingMilestoneDto {
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

  @ApiPropertyOptional({
    type: () => ProjectTrackingApprovedSubmissionFileDto,
    nullable: true,
  })
  approvedSubmissionFile?: ProjectTrackingApprovedSubmissionFileDto | null;
}

export class ProjectTrackingProgressDto {
  @ApiProperty()
  percentage: number;

  @ApiProperty()
  approved: number;

  @ApiProperty()
  submitted: number;

  @ApiProperty()
  rejected: number;

  @ApiProperty()
  pending: number;

  @ApiProperty()
  total: number;
}

export class ProjectTrackingProposalDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;
}

export class ProjectTrackingGroupDto {
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

  @ApiPropertyOptional({ type: () => ProjectTrackingStudentPersonDto, nullable: true })
  leader?: ProjectTrackingStudentPersonDto | null;

  @ApiProperty({ type: () => [ProjectTrackingGroupMemberDto] })
  members: ProjectTrackingGroupMemberDto[];

  @ApiProperty()
  totalMembers: number;
}

export class ProjectTrackingItemDto {
  @ApiProperty()
  projectId: string;

  @ApiProperty()
  projectTitle: string;

  @ApiPropertyOptional({ nullable: true })
  projectDescription?: string | null;

  @ApiProperty({ enum: ProjectStatus })
  projectStatus: ProjectStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;

  @ApiPropertyOptional({ type: () => ProjectTrackingProposalDto, nullable: true })
  proposal?: ProjectTrackingProposalDto | null;

  @ApiPropertyOptional({ type: () => ProjectTrackingPersonDto, nullable: true })
  advisor?: ProjectTrackingPersonDto | null;

  @ApiPropertyOptional({ type: () => ProjectTrackingGroupDto, nullable: true })
  group?: ProjectTrackingGroupDto | null;

  @ApiProperty({ type: () => ProjectTrackingProgressDto })
  milestoneProgress: ProjectTrackingProgressDto;

  @ApiProperty({ type: () => [ProjectTrackingMilestoneDto] })
  milestones: ProjectTrackingMilestoneDto[];
}

export class ProjectTrackingSummaryDto {
  @ApiProperty()
  totalProjects: number;

  @ApiProperty()
  activeProjects: number;

  @ApiProperty()
  completedProjects: number;

  @ApiProperty()
  cancelledProjects: number;
}

export class ProjectTrackingPaginationDto {
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

export class ProjectTrackingFiltersDto {
  @ApiPropertyOptional({ nullable: true })
  search?: string | null;

  @ApiPropertyOptional({ enum: ProjectStatus, nullable: true })
  projectStatus?: ProjectStatus | null;
}

export class ProjectTrackingResponseDto {
  @ApiProperty()
  departmentId: string;

  @ApiProperty({ type: String, format: 'date-time' })
  generatedAt: string;

  @ApiProperty({ type: () => ProjectTrackingSummaryDto })
  summary: ProjectTrackingSummaryDto;

  @ApiProperty({ type: () => ProjectTrackingPaginationDto })
  pagination: ProjectTrackingPaginationDto;

  @ApiProperty({ type: () => ProjectTrackingFiltersDto })
  filters: ProjectTrackingFiltersDto;

  @ApiProperty({ type: () => [ProjectTrackingItemDto] })
  items: ProjectTrackingItemDto[];
}
