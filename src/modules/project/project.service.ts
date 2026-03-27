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
  CreateProposalFeedbackDto,
} from './dto';
import { GroupLeaderRequestStatus, ProposalStatus } from '@prisma/client';
import { ROLES } from '../../common/constants/roles.constants';
import { NotificationService } from '../notification/notification.service';
import { CloudinaryService } from '../../core/storage/cloudinary.service';

const DEFAULT_MIN_GROUP_SIZE = 3;
const DEFAULT_MAX_GROUP_SIZE = 5;

@Injectable()
export class ProjectService {
  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly notificationService: NotificationService,
    private readonly cloudinaryService: CloudinaryService
  ) {}

  private static readonly PROPOSAL_PDF_KEY = 'proposal.pdf';
  private static readonly PROPOSAL_PDF_MAX_BYTES = 5 * 1024 * 1024;

  private normalizeMultipartTitles(input: unknown): string[] {
    if (Array.isArray(input)) {
      return input.map((v) => String(v ?? ''));
    }

    if (typeof input === 'string') {
      const trimmed = input.trim();
      if (!trimmed) {
        return [];
      }

      // Allow titles to be passed as a JSON array string (FormData convenience).
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) {
            return parsed.map((v) => String(v ?? ''));
          }
        } catch {
          // Fall through.
        }
      }

      // Otherwise treat as a single title (caller must send 3 titles).
      return [trimmed];
    }

    return [];
  }

  private hasProposalPdf(documents: unknown): boolean {
    if (!Array.isArray(documents)) return false;
    return documents.some((doc) => {
      if (!doc || typeof doc !== 'object') return false;
      const anyDoc = doc as any;
      const key = String(anyDoc.key ?? anyDoc.name ?? anyDoc.fileName ?? '').trim();
      const url = String(anyDoc.url ?? anyDoc.secureUrl ?? '').trim();
      return key.toLowerCase() === ProjectService.PROPOSAL_PDF_KEY && Boolean(url);
    });
  }

  private getExistingProposalPdfPublicId(documents: unknown): string | null {
    if (!Array.isArray(documents)) return null;
    const found = documents.find((doc) => {
      if (!doc || typeof doc !== 'object') return false;
      const anyDoc = doc as any;
      const key = String(anyDoc.key ?? anyDoc.name ?? anyDoc.fileName ?? '').trim();
      return key.toLowerCase() === ProjectService.PROPOSAL_PDF_KEY;
    }) as any;

    const publicId = String(found?.publicId ?? '').trim();
    return publicId ? publicId : null;
  }

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
    const normalizedDescription = typeof dto.description === 'string' ? dto.description.trim() : undefined;

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

    if (!this.hasProposalPdf((proposal as any).documents)) {
      throw new BadRequestException('proposal.pdf is required before submitting the proposal');
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

  async uploadProposalPdf(proposalId: string, file: Express.Multer.File, user: any) {
    const { actor } = await this.requireApprovedGroupLeader(user);

    if (!file) {
      throw new BadRequestException('proposalPdf file is required');
    }

    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Invalid file type. Allowed: PDF.');
    }

    if (typeof file.size === 'number' && file.size > ProjectService.PROPOSAL_PDF_MAX_BYTES) {
      throw new BadRequestException('File is too large. Max size is 5MB.');
    }

    const proposal = await this.projectRepository.findProposalById(proposalId);
    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    if (proposal.submittedBy !== actor.id) {
      throw new ForbiddenException('You can only upload documents for your own proposal');
    }

    if (proposal.tenantId !== actor.tenantId || proposal.departmentId !== actor.departmentId) {
      throw new ForbiddenException('Access denied to this proposal');
    }

    if (proposal.status === ProposalStatus.SUBMITTED) {
      throw new ConflictException('Cannot modify documents after submission');
    }

    if (proposal.status === ProposalStatus.APPROVED) {
      throw new ConflictException('Cannot modify documents for an approved proposal');
    }

    const existingPublicId = this.getExistingProposalPdfPublicId((proposal as any).documents);
    if (existingPublicId) {
      try {
        await this.cloudinaryService.deleteByPublicId(existingPublicId, 'raw');
      } catch {
        // Best-effort cleanup; do not block new upload if deletion fails.
      }
    }

    const uploaded = await this.cloudinaryService.uploadProposalPdf({
      tenantId: proposal.tenantId,
      departmentId: proposal.departmentId,
      proposalId: proposal.id,
      userId: actor.id,
      buffer: file.buffer,
      mimeType: file.mimetype,
      fileName: file.originalname,
    });

    const doc = {
      key: ProjectService.PROPOSAL_PDF_KEY,
      url: uploaded.secureUrl,
      publicId: uploaded.publicId,
      resourceType: uploaded.resourceType,
      mimeType: file.mimetype,
      originalName: file.originalname,
      sizeBytes: file.size,
      uploadedAt: new Date().toISOString(),
    };

    // Requirement: only one PDF -> replace full documents array.
    return this.projectRepository.updateProposalDocuments(proposal.id, [doc] as any);
  }

  async createProposalDraftWithPdf(
    dto: { titles: unknown; description: unknown },
    file: Express.Multer.File,
    user: any
  ) {
    const { actor } = await this.requireApprovedGroupLeader(user);

    const proposedTitles = this.normalizeThreeCandidateTitles(
      this.normalizeMultipartTitles(dto.titles)
    );
    const primaryTitle = proposedTitles[0];

    const normalizedDescription =
      typeof dto.description === 'string' ? dto.description.trim() : undefined;

    if (!file) {
      throw new BadRequestException('proposalPdf file is required');
    }

    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Invalid file type. Allowed: PDF.');
    }

    if (typeof file.size === 'number' && file.size > ProjectService.PROPOSAL_PDF_MAX_BYTES) {
      throw new BadRequestException('File is too large. Max size is 5MB.');
    }

    const created = await this.projectRepository.createProposal({
      tenantId: actor.tenantId,
      departmentId: actor.departmentId!,
      title: primaryTitle,
      proposedTitles,
      description: normalizedDescription,
      submittedBy: actor.id,
      documents: [],
    });

    try {
      const uploaded = await this.cloudinaryService.uploadProposalPdf({
        tenantId: created.tenantId,
        departmentId: created.departmentId,
        proposalId: created.id,
        userId: actor.id,
        buffer: file.buffer,
        mimeType: file.mimetype,
        fileName: file.originalname,
      });

      const doc = {
        key: ProjectService.PROPOSAL_PDF_KEY,
        url: uploaded.secureUrl,
        publicId: uploaded.publicId,
        resourceType: uploaded.resourceType,
        mimeType: file.mimetype,
        originalName: file.originalname,
        sizeBytes: file.size,
        uploadedAt: new Date().toISOString(),
      };

      return this.projectRepository.updateProposalDocuments(created.id, [doc] as any);
    } catch (error) {
      // Rollback draft if upload/storage fails so the UX stays "start from upload".
      try {
        await this.projectRepository.deleteProposal(created.id);
      } catch {
        // Best-effort rollback.
      }
      throw error;
    }
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

  async addProposalFeedback(proposalId: string, dto: CreateProposalFeedbackDto, user: any) {
    const proposal = await this.projectRepository.findProposalById(proposalId);
    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    const isReviewer =
      user?.roles?.includes(ROLES.ADVISOR) ||
      user?.roles?.includes(ROLES.DEPARTMENT_HEAD) ||
      user?.roles?.includes(ROLES.COORDINATOR);

    if (!isReviewer) {
      throw new ForbiddenException('Insufficient permissions to add proposal feedback');
    }

    await this.assertReviewerDepartmentAccess(user, proposal);

    if (proposal.status !== ProposalStatus.SUBMITTED) {
      throw new ConflictException('Feedback can only be added while the proposal is submitted');
    }

    const message = String(dto?.message ?? '').trim();
    if (!message) {
      throw new BadRequestException('message is required');
    }

    const authorRole = user.roles.includes(ROLES.DEPARTMENT_HEAD)
      ? ROLES.DEPARTMENT_HEAD
      : user.roles.includes(ROLES.COORDINATOR)
        ? ROLES.COORDINATOR
        : ROLES.ADVISOR;

    return this.projectRepository.createProposalFeedback({
      proposalId: proposal.id,
      authorId: user.sub,
      authorRole,
      message,
    });
  }

  async listProposalFeedbacks(proposalId: string, user: any) {
    const proposal = await this.projectRepository.findProposalById(proposalId);
    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    // Students can only see feedback for their own proposals.
    if (user.roles.includes(ROLES.STUDENT)) {
      if (proposal.submittedBy !== user.sub) {
        throw new ForbiddenException('Access denied');
      }
    } else {
      // Non-students must have department access (same rules as proposal details).
      if (!this.hasDepartmentAccess(user, proposal.departmentId)) {
        throw new ForbiddenException('Access denied');
      }
    }

    return this.projectRepository.listProposalFeedbacks(proposal.id);
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
      updateData.status === ProposalStatus.APPROVED ||
      updateData.status === ProposalStatus.REJECTED;

    if (isFinalReviewDecision && proposal.status !== ProposalStatus.SUBMITTED) {
      throw new ConflictException('Only submitted proposals can be approved or rejected');
    }

    if (
      proposal.status === ProposalStatus.APPROVED &&
      updateData.status === ProposalStatus.APPROVED
    ) {
      throw new ConflictException('Proposal is already approved');
    }

    if (
      proposal.status === ProposalStatus.REJECTED &&
      updateData.status === ProposalStatus.REJECTED
    ) {
      throw new ConflictException('Proposal is already rejected');
    }

    if (updateData.status === ProposalStatus.APPROVED) {
      if (updateData.approvedTitleIndex === undefined || updateData.approvedTitleIndex === null) {
        throw new BadRequestException('approvedTitleIndex is required when approving a proposal');
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

      if (updateData.advisorId !== undefined && updateData.advisorId !== null) {
        const advisorId = updateData.advisorId.trim();
        if (!advisorId) {
          throw new BadRequestException('advisorId must not be empty when provided');
        }

        const advisor = await this.projectRepository.findAdvisorByUserId(advisorId);
        if (!advisor || advisor.user.status !== 'ACTIVE') {
          throw new BadRequestException('Advisor not found or inactive');
        }

        if (
          advisor.user.tenantId !== proposal.tenantId ||
          advisor.departmentId !== proposal.departmentId
        ) {
          throw new BadRequestException('Advisor must belong to the same tenant and department');
        }
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
    if (!Number.isInteger(selectedTitleIndex) || selectedTitleIndex < 0 || selectedTitleIndex > 2) {
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

    const milestoneTemplateId =
      createData.milestoneTemplateId ??
      (await this.projectRepository.getOrCreateDepartmentDefaultMilestoneTemplateId({
        tenantId: proposal.tenantId,
        departmentId: proposal.departmentId,
        createdById: user?.sub,
      }));

    const project = await this.projectRepository.createProjectFromProposal(
      createData.proposalId,
      proposal.advisorId,
      milestoneTemplateId
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

    const isDepartmentAuthorized = this.hasDepartmentAccess(user, project.departmentId);
    if (!isDepartmentAuthorized) {
      const member = await this.projectRepository.findProjectMember(projectId, user.sub);
      if (!member) {
        throw new ForbiddenException('Access denied');
      }
    }

    return this.projectRepository.findMilestonesByProject(projectId);
  }

  async updateMilestoneStatus(
    milestoneId: string,
    updateData: UpdateMilestoneStatusDto,
    user: any
  ) {
    const milestone = await this.projectRepository.findMilestoneByIdWithProject(milestoneId);
    if (!milestone) {
      throw new NotFoundException('Milestone not found');
    }

    const project = milestone.project;
    if (!project) {
      throw new NotFoundException('Milestone project not found');
    }

    if (!this.hasDepartmentAccess(user, project.departmentId)) {
      throw new ForbiddenException('Access denied');
    }

    // Check permissions - advisors can approve, department heads can override
    if (!this.canUpdateMilestoneStatus(user)) {
      throw new ForbiddenException('Insufficient permissions to update milestone');
    }

    // Enforce sequential milestone flow for template-based projects.
    // Rule: A milestone cannot be SUBMITTED/APPROVED until all earlier milestones are APPROVED.
    if (
      project.milestoneTemplateId &&
      (updateData.status === 'SUBMITTED' || updateData.status === 'APPROVED')
    ) {
      const milestones = await this.projectRepository.findMilestonesByProject(project.id);
      const index = milestones.findIndex((m) => m.id === milestoneId);

      if (index > 0) {
        const blockedBy = milestones.slice(0, index).find((m) => m.status !== 'APPROVED');
        if (blockedBy) {
          throw new BadRequestException(
            'Milestone must be completed step-by-step: previous milestones must be APPROVED first'
          );
        }
      }
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
    return user.roles.includes(ROLES.DEPARTMENT_HEAD) || user.roles.includes(ROLES.COORDINATOR);
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
