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
  CreateMilestoneSubmissionFeedbackDto,
  CreateProposalFeedbackDto,
  CreateProposalRejectionReminderDto,
} from './dto';
import { GroupLeaderRequestStatus, ProposalStatus } from '@prisma/client';
import { ROLES } from '../../common/constants/roles.constants';
import { NotificationService } from '../notification/notification.service';
import { CloudinaryService } from '../../core/storage/cloudinary.service';
import { ProjectEmailService } from './project-email.service';

const DEFAULT_MIN_GROUP_SIZE = 3;
const DEFAULT_MAX_GROUP_SIZE = 5;

@Injectable()
export class ProjectService {
  private static readonly MILESTONE_REVIEW_FILE_MAX_BYTES = 20 * 1024 * 1024;

  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly notificationService: NotificationService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly projectEmailService: ProjectEmailService
  ) {}

  private static readonly PROPOSAL_PDF_KEY = 'proposal.pdf';
  private static readonly PROPOSAL_PDF_MAX_BYTES = 5 * 1024 * 1024;
  private static readonly DEFAULT_PROPOSAL_REJECTION_REMINDER_TITLE =
    'Proposal Resubmission Reminder';
  private static readonly DEFAULT_PROPOSAL_REJECTION_REMINDER_MESSAGE =
    'Your project group needs to revise and resubmit the rejected proposal before the deadline.';

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
    const { actor, approvedGroup } = await this.requireApprovedGroupLeader(user);

    const proposedTitles = this.normalizeThreeCandidateTitles(dto.titles);
    const primaryTitle = proposedTitles[0];
    const normalizedDescription = typeof dto.description === 'string' ? dto.description.trim() : undefined;

    const created = await this.projectRepository.createProposal({
      tenantId: actor.tenantId,
      departmentId: actor.departmentId!,
      projectGroupId: approvedGroup.id,
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

    // Enforce: only one SUBMITTED proposal per project group (unless REJECTED).
    // If the group already has a submitted proposal, block new submissions.
    const existingSubmitted = await this.projectRepository.findSubmittedProposalByProjectGroup({
      tenantId: proposal.tenantId,
      projectGroupId: approvedGroup.id,
    });

    if (existingSubmitted && existingSubmitted.id !== proposal.id) {
      throw new ConflictException(
        'Your group already has a submitted proposal. Wait for review or rejection before submitting another.'
      );
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

    try {
      await this.projectEmailService.sendProposalSubmittedEmails({
        proposalId: proposal.id,
        tenantId: proposal.tenantId,
        departmentId: proposal.departmentId,
      });
    } catch {
      // ignore
    }

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
    const { actor, approvedGroup } = await this.requireApprovedGroupLeader(user);

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
      projectGroupId: approvedGroup.id,
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

  async listGroupProposals(user: any) {
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

    const groupContext = await this.projectRepository.listApprovedGroupMemberUserIdsForStudent({
      tenantId: actor.tenantId,
      departmentId: actor.departmentId,
      studentUserId: actor.id,
    });

    if (!groupContext.projectGroupId) {
      throw new BadRequestException('Approved project group not found for this student');
    }

    return this.projectRepository.findProposalsByProjectGroupId({
      tenantId: actor.tenantId,
      projectGroupId: groupContext.projectGroupId,
    });
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

    // Access rules:
    // - Students: submitter OR same approved project group.
    // - Non-students: department access.
    if (user.roles.includes(ROLES.STUDENT)) {
      if (proposal.submittedBy !== user.sub) {
        const groupContext = await this.projectRepository.listApprovedGroupMemberUserIdsForStudent({
          tenantId: proposal.tenantId,
          departmentId: proposal.departmentId,
          studentUserId: user.sub,
        });

        if (
          !groupContext.projectGroupId ||
          groupContext.projectGroupId !== (proposal as any).projectGroupId
        ) {
          throw new ForbiddenException('Access denied');
        }
      }
    } else {
      if (!this.hasDepartmentAccess(user, proposal.departmentId)) {
        throw new ForbiddenException('Access denied');
      }
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

    const created = await this.projectRepository.createProposalFeedback({
      proposalId: proposal.id,
      authorId: user.sub,
      authorRole,
      message,
    });

    // In-app notification: best-effort, persist + real-time.
    try {
      const preview = message.length > 120 ? `${message.slice(0, 120)}...` : message;
      await this.notificationService.notifyProposalFeedbackAdded({
        tenantId: proposal.tenantId,
        proposalId: proposal.id,
        recipientUserIds: [proposal.submittedBy],
        authorUserId: user.sub,
        authorRole,
        messagePreview: preview,
      });

      await this.projectEmailService.sendProposalFeedbackAddedEmails({
        proposalId: proposal.id,
        authorUserId: user.sub,
        authorRole,
        messagePreview: preview,
      });
    } catch {
      // ignore
    }

    return created;
  }

  async listProposalFeedbacks(proposalId: string, user: any) {
    const proposal = await this.projectRepository.findProposalById(proposalId);
    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    // Students can see feedback for their own proposals OR proposals belonging to their approved group.
    if (user.roles.includes(ROLES.STUDENT)) {
      if (proposal.submittedBy !== user.sub) {
        const groupContext = await this.projectRepository.listApprovedGroupMemberUserIdsForStudent({
          tenantId: proposal.tenantId,
          departmentId: proposal.departmentId,
          studentUserId: user.sub,
        });

        if (!groupContext.projectGroupId || groupContext.projectGroupId !== (proposal as any).projectGroupId) {
          throw new ForbiddenException('Access denied');
        }
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

    let createdProject: any = null;
    if (updateData.status === ProposalStatus.APPROVED && !proposal.project) {
      createdProject = await this.convertApprovedProposalToProject({
        proposal: {
          ...proposal,
          ...updated,
          advisorId: updated.advisorId ?? null,
          project: null,
        },
        actorUserId: user?.sub,
      });
    }

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

    try {
      if (updateData.status === ProposalStatus.APPROVED) {
        await this.projectEmailService.sendProposalApprovedEmails({
          proposalId: proposal.id,
          reviewerUserId: user.sub,
        });
      }

      if (updateData.status === ProposalStatus.REJECTED) {
        await this.projectEmailService.sendProposalRejectedEmails({
          proposalId: proposal.id,
          reviewerUserId: user.sub,
          rejectionReason: updateData.feedback?.trim(),
        });
      }
    } catch {
      // ignore
    }

    return {
      ...updated,
      project: createdProject
        ? {
            id: createdProject.id,
            status: createdProject.status,
            advisorId: createdProject.advisorId ?? null,
          }
        : (proposal.project ?? null),
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
      ...(createdProject
        ? {
            transitionSummary: {
              proposalId: updated.id,
              projectId: createdProject.id,
              advisorId: createdProject.advisorId ?? null,
              action: 'PROPOSAL_APPROVED_AND_PROJECT_CREATED',
            },
          }
        : {}),
    };
  }

  async createProposalRejectionReminder(
    proposalId: string,
    dto: CreateProposalRejectionReminderDto,
    user: any
  ) {
    const isReviewer =
      user?.roles?.includes(ROLES.DEPARTMENT_HEAD) || user?.roles?.includes(ROLES.COORDINATOR);

    if (!isReviewer) {
      throw new ForbiddenException('Insufficient permissions to create proposal reminders');
    }

    const proposal = await this.projectRepository.findProposalById(proposalId);
    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    await this.assertReviewerDepartmentAccess(user, proposal);

    if (proposal.status !== ProposalStatus.REJECTED) {
      throw new ConflictException(
        'Proposal reminder can only be created after the proposal is rejected'
      );
    }

    const projectGroup = (proposal as any).projectGroup;
    if (!projectGroup?.id) {
      throw new BadRequestException('Rejected proposal is not linked to a project group');
    }

    if (projectGroup.status !== 'APPROVED') {
      throw new BadRequestException('Rejected proposal group must be approved');
    }

    const deadlineAt = new Date(dto.deadlineAt);
    if (Number.isNaN(deadlineAt.getTime())) {
      throw new BadRequestException('Invalid deadlineAt');
    }

    if (deadlineAt.getTime() <= Date.now()) {
      throw new BadRequestException('deadlineAt must be in the future');
    }

    const existingReminder = await this.projectRepository.findActiveProposalRejectionReminder({
      proposalId: proposal.id,
      now: new Date(),
    });

    if (existingReminder) {
      throw new ConflictException('An active reminder already exists for this rejected proposal');
    }

    const title =
      typeof dto.title === 'string' && dto.title.trim()
        ? dto.title.trim()
        : ProjectService.DEFAULT_PROPOSAL_REJECTION_REMINDER_TITLE;

    const message =
      typeof dto.message === 'string' && dto.message.trim()
        ? dto.message.trim()
        : ProjectService.DEFAULT_PROPOSAL_REJECTION_REMINDER_MESSAGE;

    const reminder = await this.projectRepository.createProposalRejectionReminder({
      tenantId: proposal.tenantId,
      departmentId: proposal.departmentId,
      projectGroupId: projectGroup.id,
      proposalId: proposal.id,
      createdByUserId: user.sub,
      title,
      message,
      deadlineAt,
      disableAfterDeadline: dto.disableAfterDeadline ?? true,
    });

    try {
      const memberUserIds = Array.isArray(projectGroup.members)
        ? projectGroup.members.map((member: any) => member?.user?.id).filter(Boolean)
        : [];

      const recipientUserIds = Array.from(
        new Set([projectGroup.leader?.id, ...memberUserIds].filter(Boolean))
      );

      await this.notificationService.notifyProposalResubmissionReminderCreated({
        tenantId: proposal.tenantId,
        proposalId: proposal.id,
        reminderId: reminder.id,
        recipientUserIds,
        actorUserId: user.sub,
        deadlineAt,
        projectGroupId: projectGroup.id,
      });
    } catch {
      // ignore
    }

    return reminder;
  }

  async assignProposalAdvisor(proposalId: string, assignData: AssignAdvisorDto, user: any) {
    const proposal = await this.projectRepository.findProposalById(proposalId);
    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    if (!this.canUpdateProposalStatus(user, proposal)) {
      throw new ForbiddenException('Insufficient permissions to assign proposal advisor');
    }

    await this.assertReviewerDepartmentAccess(user, proposal);

    if (proposal.status !== ProposalStatus.APPROVED) {
      throw new BadRequestException('Advisor can only be assigned after proposal approval');
    }

    if (proposal.project) {
      throw new ConflictException(
        'Proposal already has a project. Assign or reassign the advisor on the project instead'
      );
    }

    const advisorId = String(assignData?.advisorId ?? '').trim();
    if (!advisorId) {
      throw new BadRequestException('advisorId is required');
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

    const updated = await this.projectRepository.updateProposalAdvisor(proposalId, advisorId);
    const createdProject = await this.convertApprovedProposalToProject({
      proposal: {
        ...proposal,
        ...updated,
        advisorId,
      },
      actorUserId: user?.sub,
    });

    return {
      proposal: {
        ...updated,
        assignmentSummary: {
          proposalId: updated.id,
          advisorId: updated.advisorId,
          assignedByUserId: user.sub,
          updatedAt: updated.updatedAt,
        },
      },
      project: createdProject,
      transitionSummary: {
        proposalId: updated.id,
        advisorId: updated.advisorId,
        projectId: createdProject.id,
        action: 'ADVISOR_ASSIGNED_AND_PROJECT_CREATED',
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

  async getProjectOverviewById(id: string, user: any) {
    const project = await this.projectRepository.findProjectOverviewById(id);
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

    const totalMilestones = project.milestones.length;
    const completedMilestones = project.milestones.filter((m) => m.status === 'APPROVED').length;
    const milestoneProgressPercent =
      totalMilestones > 0 ? (completedMilestones / totalMilestones) * 100 : 0;

    return {
      projectId: project.id,
      projectTitle: project.title,
      status: project.status,
      startDate: project.createdAt,
      department: project.department,
      group: project.proposal.projectGroup
        ? {
            groupId: project.proposal.projectGroup.id,
            groupName: project.proposal.projectGroup.name,
            technologies: project.proposal.projectGroup.technologies,
            leader: project.proposal.projectGroup.leader,
            members: project.proposal.projectGroup.members,
          }
        : null,
      advisor: project.advisor,
      projectMembers: project.members,
      milestoneProgress: {
        percent: Math.round(milestoneProgressPercent * 100) / 100,
        completed: completedMilestones,
        total: totalMilestones,
      },
      milestones: project.milestones.map((m: any) => {
        const approvedSubmission = Array.isArray(m.submissions) ? m.submissions[0] : null;
        const completedAt = approvedSubmission?.approvedAt ?? (m.status === 'APPROVED' ? m.updatedAt : null);

        return {
          // Match GET /projects/:id/milestones shape
          id: m.id,
          projectId: m.projectId,
          title: m.title,
          description: m.description,
          dueDate: m.dueDate,
          status: m.status,
          submittedAt: m.submittedAt,
          feedback: m.feedback,
          createdAt: m.createdAt,
          updatedAt: m.updatedAt,

          // Additions for overview
          completedAt,
          finalApprovedFile: approvedSubmission
            ? {
                submissionId: approvedSubmission.id,
                url: approvedSubmission.fileUrl,
                publicId: approvedSubmission.filePublicId,
                fileName: approvedSubmission.fileName,
                mimeType: approvedSubmission.mimeType,
                sizeBytes: approvedSubmission.sizeBytes,
                resourceType: approvedSubmission.resourceType,
                approvedAt: approvedSubmission.approvedAt,
                approvedBy: approvedSubmission.approvedBy,
              }
            : null,
        };
      }),
    };
  }

  async createProject(createData: CreateProjectDto, user: any) {
    const proposal = await this.projectRepository.findProposalById(createData.proposalId);
    if (!proposal) {
      throw new NotFoundException('Proposal not found');
    }

    // Check permissions - only department head or coordinator can create projects
    if (!this.canCreateProject(user, proposal.departmentId)) {
      throw new ForbiddenException('Insufficient permissions to create project');
    }

    return this.convertApprovedProposalToProject({
      proposal,
      actorUserId: user?.sub,
      milestoneTemplateId: createData.milestoneTemplateId,
    });
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

    const updated = await this.projectRepository.updateProjectAdvisor(projectId, assignData.advisorId);

    try {
      const memberUserIds = Array.isArray((updated as any)?.members)
        ? (updated as any).members.map((m: any) => m?.userId).filter(Boolean)
        : [];

      await this.notificationService.notifyProjectAdvisorAssigned({
        tenantId: updated.tenantId,
        projectId: updated.id,
        advisorUserId: assignData.advisorId,
        recipientUserIds: [...memberUserIds, assignData.advisorId],
        actorUserId: user?.sub,
      });

      await this.projectEmailService.sendProjectAdvisorAssignedEmails({
        projectId: updated.id,
        advisorUserId: assignData.advisorId,
        actorUserId: user?.sub,
      });
    } catch {
      // ignore
    }

    return updated;
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

    this.assertMilestoneReviewAccess(project, user);

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

  async uploadMilestoneSubmission(milestoneId: string, file: Express.Multer.File, user: any) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Missing milestone submission file');
    }

    const milestone = await this.projectRepository.findMilestoneByIdWithProject(milestoneId);
    if (!milestone) {
      throw new NotFoundException('Milestone not found');
    }

    const project = milestone.project;
    if (!project) {
      throw new NotFoundException('Milestone project not found');
    }

    const isDepartmentAuthorized = this.hasDepartmentAccess(user, project.departmentId);
    if (!isDepartmentAuthorized) {
      const member = await this.projectRepository.findProjectMember(project.id, user.sub);
      if (!member || member.role !== 'STUDENT') {
        throw new ForbiddenException('Access denied');
      }
    }

    await this.assertMilestoneStepwiseAllowed({
      projectId: project.id,
      milestoneId,
      milestoneTemplateId: project.milestoneTemplateId,
    });

    const uploaded = await this.cloudinaryService.uploadMilestoneSubmissionFile({
      tenantId: project.tenantId,
      projectId: project.id,
      milestoneId,
      userId: user.sub,
      buffer: file.buffer,
      mimeType: file.mimetype,
      fileName: file.originalname,
    });

    // Persist submission + mark milestone submitted (atomic DB change; upload already done)
    await this.projectRepository.updateMilestoneStatus(milestoneId, { status: 'SUBMITTED' });

    return this.projectRepository.createMilestoneSubmission({
      milestoneId,
      uploadedByUserId: user.sub,
      fileName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      fileUrl: uploaded.secureUrl,
      filePublicId: uploaded.publicId,
      resourceType: uploaded.resourceType,
    });
  }

  async listMilestoneSubmissions(milestoneId: string, user: any) {
    const milestone = await this.projectRepository.findMilestoneByIdWithProject(milestoneId);
    if (!milestone) {
      throw new NotFoundException('Milestone not found');
    }

    const project = milestone.project;
    if (!project) {
      throw new NotFoundException('Milestone project not found');
    }

    const isDepartmentAuthorized = this.hasDepartmentAccess(user, project.departmentId);
    if (!isDepartmentAuthorized) {
      const member = await this.projectRepository.findProjectMember(project.id, user.sub);
      if (!member) {
        throw new ForbiddenException('Access denied');
      }
    }

    return this.projectRepository.listMilestoneSubmissions(milestoneId);
  }

  async approveMilestoneSubmission(milestoneId: string, submissionId: string, user: any) {
    const milestone = await this.projectRepository.findMilestoneByIdWithProject(milestoneId);
    if (!milestone) {
      throw new NotFoundException('Milestone not found');
    }

    const project = milestone.project;
    if (!project) {
      throw new NotFoundException('Milestone project not found');
    }

    this.assertMilestoneReviewAccess(project, user);

    await this.assertMilestoneStepwiseAllowed({
      projectId: project.id,
      milestoneId,
      milestoneTemplateId: project.milestoneTemplateId,
    });

    const approved = await this.projectRepository.approveMilestoneSubmission({
      milestoneId,
      submissionId,
      approvedByUserId: user.sub,
    });

    if (!approved) {
      throw new NotFoundException('Milestone submission not found');
    }

    try {
      const projectWithMembers = await this.projectRepository.findProjectMembers(project.id);
      const studentRecipientUserIds = Array.from(
        new Set(
          Array.isArray(projectWithMembers?.members)
            ? projectWithMembers.members
                .filter((member) => member.role === 'STUDENT')
                .map((member) => member.userId)
                .filter(Boolean)
            : []
        )
      );

      if (studentRecipientUserIds.length) {
        await this.notificationService.notifyMilestoneApproved({
          tenantId: project.tenantId,
          userIds: studentRecipientUserIds,
          departmentId: project.departmentId,
          projectId: project.id,
          projectTitle: (project as any).title,
          milestoneId: milestone.id,
          milestoneTitle: milestone.title,
          submissionId,
          projectGroupId: (project as any).proposal?.projectGroup?.id,
          projectGroupName: (project as any).proposal?.projectGroup?.name,
          actorUserId: user.sub,
        });
      }

      const department = await this.projectRepository.findDepartmentActivityTarget(
        project.departmentId
      );

      if (department?.headOfDepartmentId) {
        await this.notificationService.notifyMilestoneCompleted({
          tenantId: project.tenantId,
          userIds: [department.headOfDepartmentId],
          departmentId: project.departmentId,
          projectId: project.id,
          projectTitle: (project as any).title,
          milestoneId: milestone.id,
          milestoneTitle: milestone.title,
          projectGroupId: (project as any).proposal?.projectGroup?.id,
          projectGroupName: (project as any).proposal?.projectGroup?.name,
          actorUserId: user.sub,
        });
      }
    } catch {
      // ignore activity notification failures
    }

    return approved;
  }

  async addMilestoneSubmissionFeedback(
    milestoneId: string,
    submissionId: string,
    dto: CreateMilestoneSubmissionFeedbackDto,
    file: Express.Multer.File | undefined,
    user: any
  ) {
    const submission = await this.projectRepository.findMilestoneSubmissionByIdWithProject(
      submissionId
    );
    if (!submission || submission.milestoneId !== milestoneId) {
      throw new NotFoundException('Milestone submission not found');
    }

    const milestone = submission.milestone;
    if (!milestone) {
      throw new NotFoundException('Milestone not found');
    }

    const project = milestone.project;
    if (!project) {
      throw new NotFoundException('Milestone project not found');
    }

    this.assertMilestoneReviewAccess(project, user);

    if (submission.status === 'APPROVED') {
      throw new ConflictException('Cannot add feedback to an already approved milestone submission');
    }

    const message = String(dto?.message ?? '').trim();
    if (!message) {
      throw new BadRequestException('message is required');
    }

    if (
      file?.buffer?.length &&
      typeof file.size === 'number' &&
      file.size > ProjectService.MILESTONE_REVIEW_FILE_MAX_BYTES
    ) {
      throw new BadRequestException('Feedback attachment exceeds maximum size of 20MB');
    }

    let uploaded:
      | {
          secureUrl: string;
          publicId: string;
          resourceType: 'raw';
        }
      | undefined;

    try {
      if (file?.buffer?.length) {
        uploaded = await this.cloudinaryService.uploadMilestoneFeedbackAttachment({
          tenantId: project.tenantId,
          projectId: project.id,
          milestoneId,
          submissionId,
          userId: user.sub,
          buffer: file.buffer,
          mimeType: file.mimetype,
          fileName: file.originalname,
        });
      }

      const created = await this.projectRepository.createMilestoneSubmissionFeedback({
        submissionId,
        authorId: user.sub,
        authorRole: this.getReviewerRole(user),
        message,
        attachmentFileName: file?.originalname ?? null,
        attachmentMimeType: file?.mimetype ?? null,
        attachmentSizeBytes: typeof file?.size === 'number' ? file.size : null,
        attachmentUrl: uploaded?.secureUrl ?? null,
        attachmentPublicId: uploaded?.publicId ?? null,
        attachmentResourceType: uploaded?.resourceType ?? null,
      });

      try {
        const projectWithMembers = await this.projectRepository.findProjectMembers(project.id);
        const recipientUserIds = Array.from(
          new Set(
            Array.isArray(projectWithMembers?.members)
              ? projectWithMembers.members
                  .filter((member) => member.role === 'STUDENT')
                  .map((member) => member.userId)
                  .filter(Boolean)
              : []
          )
        );

        if (recipientUserIds.length) {
          const preview = message.length > 120 ? `${message.slice(0, 120)}...` : message;
          await this.notificationService.notifyMilestoneFeedbackAdded({
            tenantId: project.tenantId,
            userIds: recipientUserIds,
            departmentId: project.departmentId,
            projectId: project.id,
            projectTitle: project.title,
            milestoneId,
            milestoneTitle: milestone.title,
            submissionId,
            actorUserId: user.sub,
            actorRole: this.getReviewerRole(user),
            projectGroupId: project.proposal?.projectGroup?.id,
            projectGroupName: project.proposal?.projectGroup?.name,
            messagePreview: preview,
            hasAttachment: Boolean(uploaded?.secureUrl),
          });
        }
      } catch {
        // ignore notification failures
      }

      return created;
    } catch (error) {
      if (uploaded?.publicId) {
        try {
          await this.cloudinaryService.deleteByPublicId(uploaded.publicId, uploaded.resourceType);
        } catch {
          // ignore cleanup failure
        }
      }
      throw error;
    }
  }

  async listMilestoneSubmissionFeedbacks(milestoneId: string, submissionId: string, user: any) {
    const submission = await this.projectRepository.findMilestoneSubmissionByIdWithProject(
      submissionId
    );
    if (!submission || submission.milestoneId !== milestoneId) {
      throw new NotFoundException('Milestone submission not found');
    }

    const milestone = submission.milestone;
    if (!milestone) {
      throw new NotFoundException('Milestone not found');
    }

    const project = milestone.project;
    if (!project) {
      throw new NotFoundException('Milestone project not found');
    }

    await this.assertMilestoneSubmissionReadAccess(project, user);

    return this.projectRepository.listMilestoneSubmissionFeedbacks(submissionId);
  }

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

  async getAdvisorSummary(advisorId: string, user: any) {
    const advisor = await this.projectRepository.findAdvisorById(advisorId);
    if (!advisor) {
      throw new NotFoundException('Advisor not found');
    }

    if (!this.hasDepartmentAccess(user, advisor.departmentId) && user.sub !== advisor.userId) {
      throw new ForbiddenException('Access denied');
    }

    return this.projectRepository.getAdvisorSummary(advisorId);
  }

  async getMyAdvisorSummary(user: any) {
    if (!user?.sub) {
      throw new ForbiddenException('Missing user context');
    }

    const advisor = await this.projectRepository.findAdvisorByUserId(user.sub);
    if (!advisor) {
      throw new NotFoundException('Advisor profile not found');
    }

    return this.projectRepository.getAdvisorSummary(advisor.id);
  }

  async listAdvisorProjects(advisorProfileId: string, user: any) {
    const advisor = await this.projectRepository.findAdvisorById(advisorProfileId);
    if (!advisor) {
      throw new NotFoundException('Advisor not found');
    }

    // Access: department head/coordinator in same department OR the advisor themself.
    if (!this.hasDepartmentAccess(user, advisor.departmentId) && user.sub !== advisor.userId) {
      throw new ForbiddenException('Access denied');
    }

    return this.projectRepository.listAdvisorProjectsDetailed(advisor.userId);
  }

  async listAdvisorMilestoneReviewQueue(advisorProfileId: string, user: any) {
    const advisor = await this.projectRepository.findAdvisorById(advisorProfileId);
    if (!advisor) {
      throw new NotFoundException('Advisor not found');
    }

    if (!this.hasDepartmentAccess(user, advisor.departmentId) && user.sub !== advisor.userId) {
      throw new ForbiddenException('Access denied');
    }

    return this.projectRepository.listAdvisorMilestoneReviewQueue(advisor.userId);
  }

  async listAdvisorSubmittedDocuments(advisorProfileId: string, user: any) {
    const advisor = await this.projectRepository.findAdvisorById(advisorProfileId);
    if (!advisor) {
      throw new NotFoundException('Advisor not found');
    }

    if (!this.hasDepartmentAccess(user, advisor.departmentId) && user.sub !== advisor.userId) {
      throw new ForbiddenException('Access denied');
    }

    return this.projectRepository.listAdvisorSubmittedDocuments(advisor.userId);
  }

  async listMyAdvisorProjects(user: any) {
    if (!user?.sub) {
      throw new ForbiddenException('Missing user context');
    }

    const advisor = await this.projectRepository.findAdvisorByUserId(user.sub);
    if (!advisor) {
      throw new NotFoundException('Advisor profile not found');
    }

    return this.projectRepository.listAdvisorProjectsDetailed(advisor.userId);
  }

  async listMyAdvisorMilestoneReviewQueue(user: any) {
    if (!user?.sub) {
      throw new ForbiddenException('Missing user context');
    }

    const advisor = await this.projectRepository.findAdvisorByUserId(user.sub);
    if (!advisor) {
      throw new NotFoundException('Advisor profile not found');
    }

    return this.projectRepository.listAdvisorMilestoneReviewQueue(advisor.userId);
  }

  async listMyAdvisorSubmittedDocuments(user: any) {
    if (!user?.sub) {
      throw new ForbiddenException('Missing user context');
    }

    const advisor = await this.projectRepository.findAdvisorByUserId(user.sub);
    if (!advisor) {
      throw new NotFoundException('Advisor profile not found');
    }

    return this.projectRepository.listAdvisorSubmittedDocuments(advisor.userId);
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

  private async assertMilestoneStepwiseAllowed(params: {
    projectId: string;
    milestoneId: string;
    milestoneTemplateId: string | null;
  }) {
    if (!params.milestoneTemplateId) {
      return;
    }

    const milestones = await this.projectRepository.findMilestonesByProject(params.projectId);
    const index = milestones.findIndex((m) => m.id === params.milestoneId);
    if (index <= 0) {
      return;
    }

    const blockedBy = milestones.slice(0, index).find((m) => m.status !== 'APPROVED');
    if (blockedBy) {
      throw new BadRequestException(
        'Milestone must be completed step-by-step: previous milestones must be APPROVED first'
      );
    }
  }

  private getReviewerRole(user: any): string {
    if (user.roles.includes(ROLES.DEPARTMENT_HEAD)) {
      return ROLES.DEPARTMENT_HEAD;
    }

    if (user.roles.includes(ROLES.COORDINATOR)) {
      return ROLES.COORDINATOR;
    }

    return ROLES.ADVISOR;
  }

  private assertMilestoneReviewAccess(
    project: { departmentId: string; advisorId?: string | null },
    user: any
  ) {
    if (this.isPlatformAdmin(user)) {
      return;
    }

    const roles: string[] = Array.isArray(user?.roles) ? user.roles : [];
    const isSameDepartment = user?.departmentId === project.departmentId;

    if (roles.includes(ROLES.DEPARTMENT_HEAD) && isSameDepartment) {
      return;
    }

    if (roles.includes(ROLES.COORDINATOR) && isSameDepartment) {
      return;
    }

    if (
      roles.includes(ROLES.ADVISOR) &&
      isSameDepartment &&
      project.advisorId &&
      project.advisorId === user?.sub
    ) {
      return;
    }

    throw new ForbiddenException(
      'Only the assigned advisor or authorized department staff can review this milestone'
    );
  }

  private async assertMilestoneSubmissionReadAccess(
    project: { id: string; departmentId: string; advisorId?: string | null },
    user: any
  ) {
    try {
      this.assertMilestoneReviewAccess(project, user);
      return;
    } catch {
      // Fall through to member access.
    }

    const member = await this.projectRepository.findProjectMember(project.id, user?.sub);
    if (!member) {
      throw new ForbiddenException('Access denied');
    }
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

  private async convertApprovedProposalToProject(params: {
    proposal: any;
    actorUserId?: string;
    milestoneTemplateId?: string;
  }) {
    const proposal = params.proposal;

    if (proposal.status !== ProposalStatus.APPROVED) {
      throw new BadRequestException('Only approved proposals can be converted to projects');
    }

    if (proposal.project) {
      throw new BadRequestException('Proposal already has a project');
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

    const milestoneTemplateId =
      params.milestoneTemplateId ??
      (await this.projectRepository.getOrCreateDepartmentDefaultMilestoneTemplateId({
        tenantId: proposal.tenantId,
        departmentId: proposal.departmentId,
        createdById: params.actorUserId,
      }));

    const project = await this.projectRepository.createProjectFromProposal(
      proposal.id,
      proposal.advisorId ?? null,
      milestoneTemplateId
    );

    try {
      await this.projectEmailService.sendProjectCreatedEmails({
        projectId: project.id,
        actorUserId: params.actorUserId,
      });
    } catch {
      // ignore
    }

    return {
      ...project,
      creationSummary: {
        projectId: project.id,
        proposalId: proposal.id,
        finalTitle: selectedTitle,
        selectedTitleIndex,
        advisorId: proposal.advisorId ?? null,
      },
    };
  }
}
