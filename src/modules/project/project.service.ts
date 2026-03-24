import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ProjectRepository } from './project.repository';
import {
  CreateProposalDto,
  ListProposalsDto,
  UpdateProposalStatusDto,
  ListProjectsDto,
  CreateProjectDto,
  AssignAdvisorDto,
  UpdateMilestoneStatusDto,
  AddProjectMemberDto,
} from './dto';
import { GroupLeaderRequestStatus, ProposalStatus } from '@prisma/client';
import { ROLES } from '../../common/constants/roles.constants';
import { NotificationService } from '../notification/notification.service';

const DEFAULT_MIN_GROUP_SIZE = 3;
const DEFAULT_MAX_GROUP_SIZE = 5;

@Injectable()
export class ProjectService {
  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly notificationService: NotificationService
  ) {}

  private async assertReviewerDepartmentAccess(
    user: any,
    proposal: { tenantId: string; departmentId: string }
  ) {
    if (!user?.sub) {
      throw new ForbiddenException('Missing user context');
    }

    const actor = await this.projectRepository.findUserForProjectMembership(user.sub);
    if (!actor || actor.status !== 'ACTIVE') {
      throw new ForbiddenException('User not found or inactive');
    }

    if (actor.tenantId !== proposal.tenantId) {
      throw new ForbiddenException('Access denied');
    }

    if (!actor.departmentId || actor.departmentId !== proposal.departmentId) {
      throw new ForbiddenException('Access denied to this department');
    }
  }

  private async notifyProposalStatusChanged(params: {
    tenantId: string;
    departmentId: string;
    proposalId: string;
    submitterUserId: string;
    reviewerUserId: string;
    status: ProposalStatus;
    advisorId?: string;
    feedback?: string;
  }) {
    const groupContext = await this.projectRepository.listApprovedGroupMemberUserIdsForStudent({
      tenantId: params.tenantId,
      departmentId: params.departmentId,
      studentUserId: params.submitterUserId,
    });

    const recipientUserIds = Array.from(
      new Set([params.submitterUserId, ...groupContext.memberUserIds].filter(Boolean))
    );

    if (!recipientUserIds.length) {
      return;
    }

    if (params.status === ProposalStatus.APPROVED) {
      await this.notificationService.notifyProposalApproved({
        tenantId: params.tenantId,
        proposalId: params.proposalId,
        recipientUserIds,
        reviewerUserId: params.reviewerUserId,
        advisorId: params.advisorId,
        projectGroupId: groupContext.projectGroupId ?? undefined,
      });
      return;
    }

    if (params.status === ProposalStatus.REJECTED) {
      await this.notificationService.notifyProposalRejected({
        tenantId: params.tenantId,
        proposalId: params.proposalId,
        recipientUserIds,
        reviewerUserId: params.reviewerUserId,
        rejectionReason: params.feedback,
        projectGroupId: groupContext.projectGroupId ?? undefined,
      });
    }
  }

  private async requireApprovedGroupLeader(user: any) {
    if (!user?.sub) {
      throw new ForbiddenException('Missing user context');
    }

    const roles: string[] = Array.isArray(user?.roles) ? user.roles : [];
    if (!roles.includes(ROLES.STUDENT)) {
      throw new ForbiddenException('Only students can perform this action');
    }

    const actor = await this.projectRepository.findUserForProjectMembership(user.sub);
    if (!actor || actor.status !== 'ACTIVE') {
      throw new ForbiddenException('User not found or inactive');
    }

    if (!actor.departmentId) {
      throw new BadRequestException('Student is not assigned to a department');
    }

    const leaderRequest = await this.projectRepository.findGroupLeaderRequestStatus(actor.id);
    if (!leaderRequest || leaderRequest.status !== GroupLeaderRequestStatus.APPROVED) {
      throw new ForbiddenException('Only approved group leaders can perform this action');
    }

    const approvedGroup = await this.projectRepository.findApprovedProjectGroupByLeader({
      tenantId: actor.tenantId,
      departmentId: actor.departmentId,
      leaderUserId: actor.id,
    });

    if (!approvedGroup) {
      throw new BadRequestException('Approved project group not found for this group leader');
    }

    return {
      actor,
      approvedGroup,
    };
  }

  private normalizeThreeCandidateTitles(titles: string[]) {
    if (!Array.isArray(titles) || titles.length !== 3) {
      throw new BadRequestException('Exactly 3 project titles are required');
    }

    const normalized = titles.map((title) => String(title ?? '').trim());
    if (normalized.some((title) => !title)) {
      throw new BadRequestException('All project titles must be non-empty');
    }

    const dedupSet = new Set(normalized.map((title) => title.toLowerCase()));
    if (dedupSet.size !== normalized.length) {
      throw new BadRequestException('Project titles must be unique');
    }

    return normalized;
  }

  private async notifyProposalSubmitted(params: {
    tenantId: string;
    departmentId: string;
    proposalId: string;
    submitterUserId: string;
    projectGroupId?: string;
  }) {
    const reviewerUserIds = await this.projectRepository.listDepartmentProposalReviewerUserIds(
      params.tenantId,
      params.departmentId
    );

    if (!reviewerUserIds.length) {
      return;
    }

    await this.notificationService.notifyProposalSubmitted({
      tenantId: params.tenantId,
      proposalId: params.proposalId,
      submitterUserId: params.submitterUserId,
      reviewerUserIds,
      projectGroupId: params.projectGroupId,
    });
  }

  private isPlatformAdmin(user: any): boolean {
    const roles: string[] = Array.isArray(user?.roles) ? user.roles : [];
    return roles.includes(ROLES.PLATFORM_ADMIN);
  }

  private async assertProjectAccessByDepartment(
    user: any,
    project: { tenantId: string; departmentId: string }
  ) {
    if (!user?.sub) {
      throw new ForbiddenException('Missing user context');
    }

    if (this.isPlatformAdmin(user)) {
      return;
    }

    const actor = await this.projectRepository.findUserForProjectMembership(user.sub);
    if (!actor || actor.status !== 'ACTIVE') {
      throw new ForbiddenException('User not found or inactive');
    }

    if (actor.tenantId !== project.tenantId) {
      throw new ForbiddenException('Access denied');
    }

    if (!actor.departmentId || actor.departmentId !== project.departmentId) {
      throw new ForbiddenException('Access denied to this department');
    }
  }

  // Proposal methods
  async createProposalDraft(dto: CreateProposalDto, user: any) {
    const { actor } = await this.requireApprovedGroupLeader(user);

    const proposedTitles = this.normalizeThreeCandidateTitles(dto.titles);
    const primaryTitle = proposedTitles[0];
    const normalizedDescription = String(dto.description ?? '').trim();
    if (!normalizedDescription) {
      throw new BadRequestException('description is required');
    }

    const created = await this.projectRepository.createProposal({
      tenantId: actor.tenantId,
      departmentId: actor.departmentId!,
      title: primaryTitle,
      proposedTitles,
      description: normalizedDescription,
      submittedBy: actor.id,
      documents: dto.documents,
    });

    return created;
  }

  async submitProposal(id: string, user: any) {
    const { actor, approvedGroup } = await this.requireApprovedGroupLeader(user);

    const proposal = await this.projectRepository.findProposalById(id);
    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    if (proposal.submittedBy !== actor.id) {
      throw new ForbiddenException('You can only submit your own proposal');
    }

    if (proposal.tenantId !== actor.tenantId || proposal.departmentId !== actor.departmentId) {
      throw new ForbiddenException('Access denied to this proposal');
    }

    if (proposal.status === ProposalStatus.SUBMITTED) {
      throw new ConflictException('Proposal is already submitted');
    }

    if (proposal.status === ProposalStatus.APPROVED) {
      throw new ConflictException('Approved proposals cannot be resubmitted');
    }

    if (!this.isValidStatusTransition(proposal.status, ProposalStatus.SUBMITTED)) {
      throw new BadRequestException('Invalid status transition');
    }

    const updated = await this.projectRepository.updateProposalStatus(id, {
      status: ProposalStatus.SUBMITTED,
      feedback: null,
    });

    await this.notifyProposalSubmitted({
      tenantId: proposal.tenantId,
      departmentId: proposal.departmentId,
      proposalId: proposal.id,
      submitterUserId: proposal.submittedBy,
      projectGroupId: approvedGroup.id,
    });

    return updated;
  }

  async listMyProposals(user: any) {
    const { actor } = await this.requireApprovedGroupLeader(user);
    return this.projectRepository.findProposalsBySubmitter(actor.id);
  }

  async getProposals(departmentId: string, filters: ListProposalsDto, user: any) {
    // Check if user has access to department
    if (!this.hasDepartmentAccess(user, departmentId)) {
      throw new ForbiddenException('Access denied to this department');
    }

    const startDate = filters.startDate ? new Date(filters.startDate) : undefined;
    const endDate = filters.endDate ? new Date(filters.endDate) : undefined;

    return this.projectRepository.findProposalsByDepartment(departmentId, {
      status: filters.status,
      startDate,
      endDate,
    });
  }

  async getProposalById(id: string, user: any) {
    const proposal = await this.projectRepository.findProposalById(id);
    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    // Check access
    if (!this.hasDepartmentAccess(user, proposal.departmentId)) {
      throw new ForbiddenException('Access denied');
    }

    // Students can only see their own proposals
    if (user.roles.includes(ROLES.STUDENT) && proposal.submittedBy !== user.sub) {
      throw new ForbiddenException('Access denied');
    }

    return proposal;
  }

  async updateProposalStatus(id: string, updateData: UpdateProposalStatusDto, user: any) {
    const proposal = await this.projectRepository.findProposalById(id);
    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    // Check permissions
    if (!this.canUpdateProposalStatus(user, proposal)) {
      throw new ForbiddenException('Insufficient permissions to update proposal status');
    }

    await this.assertReviewerDepartmentAccess(user, proposal);

    const isFinalReviewDecision =
      updateData.status === ProposalStatus.APPROVED || updateData.status === ProposalStatus.REJECTED;

    if (isFinalReviewDecision && proposal.status !== ProposalStatus.SUBMITTED) {
      throw new ConflictException('Only submitted proposals can be approved or rejected');
    }

    if (proposal.status === ProposalStatus.APPROVED && updateData.status === ProposalStatus.APPROVED) {
      throw new ConflictException('Proposal is already approved');
    }

    if (proposal.status === ProposalStatus.REJECTED && updateData.status === ProposalStatus.REJECTED) {
      throw new ConflictException('Proposal is already rejected');
    }

    if (updateData.status === ProposalStatus.APPROVED) {
      if (!updateData.advisorId?.trim()) {
        throw new BadRequestException('advisorId is required when approving a proposal');
      }

      if (updateData.approvedTitleIndex === undefined || updateData.approvedTitleIndex === null) {
        throw new BadRequestException(
          'approvedTitleIndex is required when approving a proposal'
        );
      }

      const proposalWithTitles = proposal as any;
      const proposedTitlesRaw = Array.isArray(proposalWithTitles.proposedTitles)
        ? proposalWithTitles.proposedTitles
        : null;

      if (!proposedTitlesRaw || proposedTitlesRaw.length !== 3) {
        throw new BadRequestException('Proposal candidate titles are missing or invalid');
      }

      const approvedTitle = String(proposedTitlesRaw[updateData.approvedTitleIndex] ?? '').trim();
      if (!approvedTitle) {
        throw new BadRequestException('approvedTitleIndex is invalid for this proposal');
      }

      const advisor = await this.projectRepository.findAdvisorByUserId(updateData.advisorId.trim());
      if (!advisor || advisor.user.status !== 'ACTIVE') {
        throw new BadRequestException('Advisor not found or inactive');
      }

      if (advisor.user.tenantId !== proposal.tenantId || advisor.departmentId !== proposal.departmentId) {
        throw new BadRequestException('Advisor must belong to the same tenant and department');
      }
    }

    if (updateData.status === ProposalStatus.REJECTED && !updateData.feedback?.trim()) {
      throw new BadRequestException('feedback is required when rejecting a proposal');
    }

    // Validate status transition
    if (!this.isValidStatusTransition(proposal.status, updateData.status as ProposalStatus)) {
      throw new BadRequestException('Invalid status transition');
    }

    const updated = await this.projectRepository.updateProposalStatus(id, {
      ...updateData,
      advisorId: updateData.advisorId?.trim(),
      feedback: updateData.feedback?.trim(),
      ...(updateData.status === ProposalStatus.APPROVED
        ? {
            selectedTitleIndex: updateData.approvedTitleIndex,
            title: String((proposal as any).proposedTitles[updateData.approvedTitleIndex!]).trim(),
          }
        : {}),
    });

    await this.notifyProposalStatusChanged({
      tenantId: proposal.tenantId,
      departmentId: proposal.departmentId,
      proposalId: proposal.id,
      submitterUserId: proposal.submittedBy,
      reviewerUserId: user.sub,
      status: updateData.status,
      advisorId: updateData.advisorId,
      feedback: updateData.feedback,
    });

    return {
      ...updated,
      reviewSummary: {
        proposalId: updated.id,
        decision: updated.status,
        selectedTitleIndex: (updated as any).selectedTitleIndex ?? null,
        selectedTitle: updated.title,
        advisorId: updated.advisorId ?? null,
        feedback: updated.feedback ?? null,
        reviewedByUserId: user.sub,
        updatedAt: updated.updatedAt,
      },
    };
  }

  // Project methods
  async getProjects(departmentId: string, filters: ListProjectsDto, user: any) {
    if (!this.hasDepartmentAccess(user, departmentId)) {
      throw new ForbiddenException('Access denied to this department');
    }

    return this.projectRepository.findProjectsByDepartment(departmentId, filters);
  }

  async getProjectById(id: string, user: any) {
    const project = await this.projectRepository.findProjectById(id);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (!this.hasDepartmentAccess(user, project.departmentId)) {
      throw new ForbiddenException('Access denied');
    }

    // Students can only see projects they're members of
    if (user.roles.includes(ROLES.STUDENT) && !project.members.some((m) => m.userId === user.sub)) {
      throw new ForbiddenException('Access denied');
    }

    return project;
  }

  async createProject(createData: CreateProjectDto, user: any) {
    const proposal = await this.projectRepository.findProposalById(createData.proposalId);
    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    if (proposal.status !== ProposalStatus.APPROVED) {
      throw new BadRequestException('Only approved proposals can be converted to projects');
    }

    if (proposal.project) {
      throw new BadRequestException('Proposal already has a project');
    }

    if (!proposal.advisorId?.trim()) {
      throw new BadRequestException(
        'Approved proposal must include an assigned advisor before project creation'
      );
    }

    const proposalWithTitles = proposal as any;
    const proposedTitlesRaw = Array.isArray(proposalWithTitles.proposedTitles)
      ? proposalWithTitles.proposedTitles
      : null;

    if (!proposedTitlesRaw || proposedTitlesRaw.length !== 3) {
      throw new BadRequestException(
        'Approved proposal is missing candidate title context (expected 3 titles)'
      );
    }

    const selectedTitleIndex = proposalWithTitles.selectedTitleIndex;
    if (
      !Number.isInteger(selectedTitleIndex) ||
      selectedTitleIndex < 0 ||
      selectedTitleIndex > 2
    ) {
      throw new BadRequestException('Approved proposal is missing a valid selected title index');
    }

    const selectedTitle = String(proposedTitlesRaw[selectedTitleIndex] ?? '').trim();
    if (!selectedTitle) {
      throw new BadRequestException('Selected proposal title is invalid or empty');
    }

    if (String(proposal.title ?? '').trim() !== selectedTitle) {
      throw new ConflictException('Proposal title does not match the reviewer-selected title');
    }

    // Check permissions - only department head or coordinator can create projects
    if (!this.canCreateProject(user, proposal.departmentId)) {
      throw new ForbiddenException('Insufficient permissions to create project');
    }

    const project = await this.projectRepository.createProjectFromProposal(
      createData.proposalId,
      proposal.advisorId
    );

    return {
      ...project,
      creationSummary: {
        projectId: project.id,
        proposalId: proposal.id,
        finalTitle: selectedTitle,
        selectedTitleIndex,
        advisorId: proposal.advisorId,
      },
    };
  }

  async assignAdvisor(projectId: string, assignData: AssignAdvisorDto, user: any) {
    const project = await this.projectRepository.findProjectById(projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Check permissions
    if (!this.canAssignAdvisor(user, project.departmentId)) {
      throw new ForbiddenException('Insufficient permissions to assign advisor');
    }

    return this.projectRepository.updateProjectAdvisor(projectId, assignData.advisorId);
  }

  // Milestone methods
  async getProjectMilestones(projectId: string, user: any) {
    const project = await this.projectRepository.findProjectById(projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (!this.hasDepartmentAccess(user, project.departmentId)) {
      throw new ForbiddenException('Access denied');
    }

    return this.projectRepository.findMilestonesByProject(projectId);
  }

  async updateMilestoneStatus(
    milestoneId: string,
    updateData: UpdateMilestoneStatusDto,
    user: any
  ) {
    // First get the milestone to check project access
    const milestone = await this.projectRepository
      .findMilestonesByProject('temp')
      .then((milestones) => milestones.find((m) => m.id === milestoneId));

    if (!milestone) {
      // Need to find milestone properly
      // For now, assume access is checked via project
      // TODO: Add method to get milestone with project
    }

    // Check permissions - advisors can approve, department heads can override
    if (!this.canUpdateMilestoneStatus(user)) {
      throw new ForbiddenException('Insufficient permissions to update milestone');
    }

    return this.projectRepository.updateMilestoneStatus(milestoneId, updateData);
  }

  // Advisor methods
  async getAdvisors(departmentId: string, includeLoad: boolean, user: any) {
    if (!this.hasDepartmentAccess(user, departmentId)) {
      throw new ForbiddenException('Access denied to this department');
    }

    return this.projectRepository.findAdvisorsByDepartment(departmentId, includeLoad);
  }

  async getAdvisorWorkload(advisorId: string, user: any) {
    const advisor = await this.projectRepository.findAdvisorById(advisorId);
    if (!advisor) {
      throw new NotFoundException('Advisor not found');
    }

    // Check access - department head, coordinator, or the advisor themselves
    if (!this.hasDepartmentAccess(user, advisor.departmentId) && user.sub !== advisor.userId) {
      throw new ForbiddenException('Access denied');
    }

    return this.projectRepository.getAdvisorWorkload(advisorId);
  }

  async checkAdvisorAvailability(departmentId: string, minCapacity: number, user: any) {
    if (!this.hasDepartmentAccess(user, departmentId)) {
      throw new ForbiddenException('Access denied to this department');
    }

    return this.projectRepository.checkAdvisorAvailability(departmentId, minCapacity);
  }

  async setAdvisorLoadLimit(advisorId: string, loadLimit: number, user: any) {
    const advisor = await this.projectRepository.findAdvisorById(advisorId);
    if (!advisor) {
      throw new NotFoundException('Advisor not found');
    }

    // Only department head can set load limits
    if (!user.roles.includes(ROLES.DEPARTMENT_HEAD)) {
      throw new ForbiddenException('Only department heads can set advisor load limits');
    }

    if (!this.hasDepartmentAccess(user, advisor.departmentId)) {
      throw new ForbiddenException('Access denied');
    }

    // Cannot set load limit below current load
    if (loadLimit < advisor.currentLoad) {
      throw new BadRequestException('Cannot set load limit below current load');
    }

    return this.projectRepository.updateAdvisorLoadLimit(advisorId, loadLimit);
  }

  async addStudentMember(projectId: string, dto: AddProjectMemberDto, user: any) {
    if (!this.canManageProjectMembers(user)) {
      throw new ForbiddenException('Insufficient permissions to manage project members');
    }

    const project = await this.projectRepository.findProjectForMemberManagement(projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.status !== 'ACTIVE') {
      throw new BadRequestException('Cannot modify members for non-active projects');
    }

    await this.assertProjectAccessByDepartment(user, project);

    const setting = await this.projectRepository.findDepartmentGroupSizeSetting(
      project.departmentId
    );
    const minGroupSize = setting?.minGroupSize ?? DEFAULT_MIN_GROUP_SIZE;
    const maxGroupSize = setting?.maxGroupSize ?? DEFAULT_MAX_GROUP_SIZE;

    const currentStudentCount = project.members.filter((m) => m.role === 'STUDENT').length;
    if (currentStudentCount + 1 > maxGroupSize) {
      throw new BadRequestException(`Group cannot exceed maxGroupSize (${maxGroupSize})`);
    }

    const targetUser = await this.projectRepository.findUserForProjectMembership(dto.userId);
    if (!targetUser) {
      throw new NotFoundException('User not found');
    }

    if (targetUser.status !== 'ACTIVE') {
      throw new BadRequestException('User must be ACTIVE to be added to a project');
    }

    if (targetUser.tenantId !== project.tenantId) {
      throw new ForbiddenException('User must belong to the same tenant');
    }

    if (targetUser.departmentId !== project.departmentId) {
      throw new ForbiddenException('User must belong to the same department');
    }

    const isStudent = await this.projectRepository.userHasActiveRoleInTenant({
      userId: dto.userId,
      tenantId: project.tenantId,
      roleName: ROLES.STUDENT,
    });
    if (!isStudent) {
      throw new BadRequestException('User must have STUDENT role to be added as a student member');
    }

    const membership = await this.projectRepository.upsertStudentMember(projectId, dto.userId);

    return {
      projectId: membership.projectId,
      userId: membership.userId,
      role: membership.role,
      minGroupSize,
      maxGroupSize,
    };
  }

  async removeStudentMember(projectId: string, memberUserId: string, user: any) {
    if (!this.canManageProjectMembers(user)) {
      throw new ForbiddenException('Insufficient permissions to manage project members');
    }

    const project = await this.projectRepository.findProjectForMemberManagement(projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.status !== 'ACTIVE') {
      throw new BadRequestException('Cannot modify members for non-active projects');
    }

    await this.assertProjectAccessByDepartment(user, project);

    const member = await this.projectRepository.findProjectMember(projectId, memberUserId);
    if (!member) {
      throw new NotFoundException('Project member not found');
    }

    if (member.role !== 'STUDENT') {
      throw new BadRequestException('Only STUDENT members can be removed with this endpoint');
    }

    const setting = await this.projectRepository.findDepartmentGroupSizeSetting(
      project.departmentId
    );
    const minGroupSize = setting?.minGroupSize ?? DEFAULT_MIN_GROUP_SIZE;
    const maxGroupSize = setting?.maxGroupSize ?? DEFAULT_MAX_GROUP_SIZE;

    const currentStudentCount = project.members.filter((m) => m.role === 'STUDENT').length;
    const remaining = currentStudentCount - 1;
    if (remaining < minGroupSize) {
      throw new BadRequestException(`Group cannot go below minGroupSize (${minGroupSize})`);
    }

    const removed = await this.projectRepository.removeProjectMember(projectId, memberUserId);

    return {
      projectId: removed.projectId,
      userId: removed.userId,
      role: removed.role,
      minGroupSize,
      maxGroupSize,
    };
  }

  async listProjectMembers(projectId: string, user: any) {
    const project = await this.projectRepository.findProjectMembers(projectId);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (this.isPlatformAdmin(user)) {
      return {
        projectId: project.id,
        members: project.members,
      };
    }

    // Students can list only if they are members.
    if (Array.isArray(user?.roles) && user.roles.includes(ROLES.STUDENT)) {
      const isMember = project.members.some((m) => m.userId === user.sub);
      if (!isMember) {
        throw new ForbiddenException('Access denied');
      }

      return {
        projectId: project.id,
        members: project.members,
      };
    }

    await this.assertProjectAccessByDepartment(user, project);

    return {
      projectId: project.id,
      members: project.members,
    };
  }

  // Helper methods
  private hasDepartmentAccess(user: any, departmentId: string): boolean {
    return (
      user.departmentId === departmentId ||
      user.roles.includes(ROLES.PLATFORM_ADMIN) ||
      user.roles.includes(ROLES.DEPARTMENT_HEAD)
    );
  }

  private canUpdateProposalStatus(user: any, _proposal: any): boolean {
    return (
      user.roles.includes(ROLES.DEPARTMENT_HEAD) ||
      user.roles.includes(ROLES.COORDINATOR)
    );
  }

  private canManageProjectMembers(user: any): boolean {
    return (
      user.roles.includes(ROLES.DEPARTMENT_HEAD) ||
      user.roles.includes(ROLES.COORDINATOR) ||
      user.roles.includes(ROLES.PLATFORM_ADMIN)
    );
  }

  private canCreateProject(user: any, departmentId: string): boolean {
    return (
      user.roles.includes(ROLES.DEPARTMENT_HEAD) ||
      user.roles.includes(ROLES.COORDINATOR) ||
      (user.roles.includes(ROLES.ADVISOR) && user.departmentId === departmentId)
    );
  }

  private canAssignAdvisor(user: any, _departmentId: string): boolean {
    return user.roles.includes(ROLES.DEPARTMENT_HEAD) || user.roles.includes(ROLES.COORDINATOR);
  }

  private canUpdateMilestoneStatus(user: any): boolean {
    return (
      user.roles.includes(ROLES.DEPARTMENT_HEAD) ||
      user.roles.includes(ROLES.ADVISOR) ||
      user.roles.includes(ROLES.COORDINATOR)
    );
  }

  private isValidStatusTransition(current: ProposalStatus, next: ProposalStatus): boolean {
    const transitions: Record<ProposalStatus, ProposalStatus[]> = {
      [ProposalStatus.DRAFT]: [ProposalStatus.SUBMITTED],
      [ProposalStatus.SUBMITTED]: [ProposalStatus.APPROVED, ProposalStatus.REJECTED],
      [ProposalStatus.APPROVED]: [],
      [ProposalStatus.REJECTED]: [ProposalStatus.SUBMITTED], // Allow resubmission
    };

    return transitions[current]?.includes(next) ?? false;
  }
}
