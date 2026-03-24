import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AdvisorAnnouncementAudience,
  AdvisorAnnouncementPriority,
  AdvisorAnnouncementStatus,
  AdvisorMessageGroupPrivacy,
  AdvisorProjectStatus,
  MilestoneStatus,
  Prisma,
  ProjectClearanceStatus,
  ProjectDocumentStatus,
  ProjectDocumentType,
  ProjectEvaluationPriority,
  ProjectEvaluationStatus,
  ProjectMeetingStatus,
  ProjectMeetingType,
  ProjectMemberRole,
  ProjectStatus,
  ProposalStatus,
  UserStatus,
} from '@prisma/client';

import { ROLES } from '../../common/constants/roles.constants';
import { CloudinaryService } from '../../core/storage/cloudinary.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ClearProjectDto } from './dto/clear-project.dto';
import { CreateAdvisorAnnouncementDto } from './dto/create-advisor-announcement.dto';
import { CreateAdvisorMessageDto } from './dto/create-advisor-message.dto';
import { CreateAdvisorMessageGroupDto } from './dto/create-advisor-message-group.dto';
import { CreateProjectDocumentDto } from './dto/create-project-document.dto';
import { CreateProjectMeetingDto } from './dto/create-project-meeting.dto';
import { CreateProjectRevisionRequestDto } from './dto/create-project-revision-request.dto';
import { ReviewProjectDocumentDto } from './dto/review-project-document.dto';
import { UpdateProjectEvaluationDto } from './dto/update-project-evaluation.dto';
import { UpdateProjectMeetingDto } from './dto/update-project-meeting.dto';

type RequestUser = { sub?: string; roles?: string[] };
type AdvisorCtx = { userId: string; tenantId: string; departmentId: string; fullName: string };

@Injectable()
export class AdvisorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService
  ) {}

  async getDashboardOverview(user: RequestUser) {
    const ctx = await this.ctx(user);
    const projects = await this.projects(ctx);
    const proposals = await this.prisma.proposal.findMany({
      where: { tenantId: ctx.tenantId, departmentId: ctx.departmentId, advisorId: ctx.userId },
      include: { submitter: true },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    });
    const students = new Map<string, any>();
    const milestones: any[] = [];
    for (const project of projects as any[]) {
      for (const member of this.studentMembers(project)) {
        if (!students.has(member.userId)) {
          students.set(member.userId, {
            id: member.userId,
            name: this.fullName(member.user),
            projectId: project.id,
            projectName: project.title,
            status: member.user.status === UserStatus.ACTIVE ? 'Active' : 'On Leave',
            avatarUrl: member.user.avatarUrl ?? undefined,
          });
        }
      }
      for (const milestone of project.milestones ?? []) milestones.push({ project, milestone });
    }
    milestones.sort((a, b) => (b.milestone.submittedAt ?? b.milestone.dueDate).getTime() - (a.milestone.submittedAt ?? a.milestone.dueDate).getTime());
    return {
      stats: {
        totalAssignedStudents: students.size,
        totalActiveProjects: (projects as any[]).filter((p) => !['completed', 'cleared'].includes(this.projectStatus(p))).length,
        pendingProposalReviews: proposals.filter((p) => p.status === ProposalStatus.SUBMITTED).length,
        pendingMilestoneReviews: milestones.filter((m) => m.milestone.status === MilestoneStatus.SUBMITTED).length,
      },
      recentProposals: proposals.map((proposal: any) => ({
        id: proposal.id,
        title: proposal.title,
        studentName: this.fullName(proposal.submitter),
        studentId: proposal.submitter?.id ?? proposal.submittedBy,
        submittedAt: proposal.updatedAt.toISOString(),
        status: this.proposalStatus(proposal.status),
        documentUrl: this.firstUrl(proposal.documents),
      })),
      recentMilestones: milestones.slice(0, 5).map(({ project, milestone }) => ({
        id: milestone.id,
        projectId: project.id,
        projectName: project.title,
        title: milestone.title,
        dueDate: milestone.dueDate.toISOString(),
        submittedAt: milestone.submittedAt?.toISOString(),
        status: this.milestoneReviewStatus(milestone),
        studentName: this.primaryStudentName(project),
        documentUrl: milestone.documents?.[0]?.fileUrl ?? undefined,
      })),
      myStudents: Array.from(students.values()).slice(0, 8),
    };
  }

  async listMyProjects(user: RequestUser, query: Record<string, string | undefined>) {
    const items = (await this.projects(await this.ctx(user))).map((project: any) => this.mapProject(project));
    const search = this.norm(query.search);
    const status = this.norm(query.status);
    const filtered = items.filter((item) => (!search || [item.title, item.groupName].some((v: string) => v.toLowerCase().includes(search))) && (!status || item.status === status));
    return {
      items: filtered,
      stats: {
        totalProjects: items.length,
        activeProjects: items.filter((item: any) => ['active', 'in-progress', 'pending-review'].includes(item.status)).length,
        clearedProjects: items.filter((item: any) => item.status === 'cleared').length,
        completedProjects: items.filter((item: any) => item.status === 'completed').length,
      },
    };
  }

  async getMyProjectById(user: RequestUser, projectId: string) {
    const project = await this.project(await this.ctx(user), projectId);
    return {
      ...this.mapProject(project),
      revisionRequests: (project.revisionRequests ?? []).map((r: any) => ({
        id: r.id,
        subject: r.subject,
        feedback: r.feedback,
        status: String(r.status).toLowerCase(),
        createdAt: r.createdAt.toISOString(),
        resolvedAt: r.resolvedAt?.toISOString() ?? null,
      })),
    };
  }

  async listStudents(user: RequestUser, query: Record<string, string | undefined>) {
    const items = (await this.projects(await this.ctx(user))).map((project: any) => this.mapClearanceProject(project));
    const search = this.norm(query.search);
    const status = this.norm(query.status);
    const filtered = items.filter((item) => (!search || [item.title, item.groupName].some((v: string) => v.toLowerCase().includes(search))) && (!status || item.status === status));
    return {
      items: filtered,
      stats: {
        readyForClearance: items.filter((item: any) => item.status === 'ready_for_clearance').length,
        clearedProjects: items.filter((item: any) => item.status === 'cleared').length,
        revisionRequired: items.filter((item: any) => item.status === 'revision_required').length,
        totalStudents: items.reduce((total: number, item: any) => total + item.members.length, 0),
      },
    };
  }

  async clearProject(user: RequestUser, projectId: string, dto: ClearProjectDto) {
    const ctx = await this.ctx(user);
    const project = await this.project(ctx, projectId);
    const updated = await this.prisma.project.update({
      where: { id: project.id },
      data: {
        clearanceStatus: ProjectClearanceStatus.CLEARED,
        advisorStatus: AdvisorProjectStatus.CLEARED,
        clearedAt: new Date(),
        clearanceNotes: dto.notes ?? null,
      },
    });
    return { id: updated.id, title: updated.title, clearanceStatus: 'cleared', clearedAt: updated.clearedAt?.toISOString(), notes: updated.clearanceNotes ?? null };
  }

  async requestProjectRevision(user: RequestUser, projectId: string, dto: CreateProjectRevisionRequestDto) {
    const ctx = await this.ctx(user);
    return this.createRevision(ctx, await this.project(ctx, projectId), dto);
  }

  async listEvaluations(user: RequestUser, query: Record<string, string | undefined>) {
    const ctx = await this.ctx(user);
    const items = (await this.prisma.projectEvaluation.findMany({
      where: { tenantId: ctx.tenantId, departmentId: ctx.departmentId, advisorUserId: ctx.userId },
      include: { project: { include: { proposal: { include: { submitter: true } } } }, studentUser: true, revisionRequests: true },
      orderBy: { submittedAt: 'desc' },
    }) as any[]).map((evaluation) => this.mapEvaluationRow(evaluation));
    const search = this.norm(query.search);
    const status = this.norm(query.status);
    const type = this.norm(query.projectType ?? query.type);
    const priority = this.norm(query.priority);
    const filtered = items.filter((item) => (!search || [item.studentName, item.studentId ?? '', item.projectTitle].some((v: string) => v.toLowerCase().includes(search))) && (!status || item.status.toLowerCase() === status) && (!type || (item.projectType ?? '').toLowerCase() === type) && (!priority || (item.priority ?? '').toLowerCase() === priority));
    const pending = items.filter((item: any) => item.status === 'Pending Review').length;
    const done = items.filter((item: any) => item.status === 'Evaluated').length;
    return { items: filtered, stats: { totalEvaluations: items.length, pendingReview: pending, evaluatedCount: done, needsRevision: items.filter((item: any) => item.status === 'Needs Revision').length, overdueCount: items.filter((item: any) => item.status === 'Pending Review' && item.dueDate && new Date(item.dueDate).getTime() < Date.now()).length, completionRate: items.length ? Math.round((done / items.length) * 100) : 0 } };
  }

  async getEvaluationById(user: RequestUser, evaluationId: string) {
    return this.mapEvaluationDetail(await this.evaluation(await this.ctx(user), evaluationId));
  }

  async updateEvaluation(user: RequestUser, evaluationId: string, dto: UpdateProjectEvaluationDto) {
    const ctx = await this.ctx(user);
    await this.evaluation(ctx, evaluationId);
    const updated = await this.prisma.projectEvaluation.update({
      where: { id: evaluationId },
      data: { summary: dto.summary, feedback: dto.feedback, grade: dto.grade, status: dto.status, priority: dto.priority, dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined, projectType: dto.projectType },
      include: { project: { include: { proposal: { include: { submitter: true } } } }, studentUser: true, revisionRequests: true },
    });
    return this.mapEvaluationDetail(updated);
  }

  async requestEvaluationRevision(user: RequestUser, evaluationId: string, dto: CreateProjectRevisionRequestDto) {
    const ctx = await this.ctx(user);
    const evaluation = await this.evaluation(ctx, evaluationId);
    await this.prisma.projectEvaluation.update({ where: { id: evaluation.id }, data: { status: ProjectEvaluationStatus.NEEDS_REVISION, feedback: dto.feedback } });
    return this.createRevision(ctx, await this.project(ctx, evaluation.projectId), { ...dto, evaluationId: evaluation.id, subject: dto.subject || `Revision required for ${evaluation.project.title} evaluation` });
  }

  async listDocuments(user: RequestUser, query: Record<string, string | undefined>) {
    const ctx = await this.ctx(user);
    const items = (await this.prisma.projectDocument.findMany({
      where: { tenantId: ctx.tenantId, departmentId: ctx.departmentId, project: { is: { advisorId: ctx.userId } } },
      include: { project: true, uploadedBy: true, reviewedBy: true },
      orderBy: { createdAt: 'desc' },
    }) as any[]).map((document) => this.mapDocumentRow(document));
    const search = this.norm(query.search);
    const type = this.norm(query.type);
    const status = this.norm(query.status);
    const filtered = items.filter((item) => (!search || [item.name, item.project, item.group].some((v: string) => v.toLowerCase().includes(search))) && (!type || item.type === type) && (!status || item.status === status));
    return { items: filtered, stats: { totalDocuments: items.length, approvedCount: items.filter((item: any) => item.status === 'approved').length, pendingReviewCount: items.filter((item: any) => item.status === 'pending_review').length, revisionRequiredCount: items.filter((item: any) => item.status === 'revision_required').length } };
  }

  async getDocumentById(user: RequestUser, documentId: string) {
    return this.mapDocumentDetail(await this.document(await this.ctx(user), documentId));
  }

  async uploadDocument(user: RequestUser, dto: CreateProjectDocumentDto, file: Express.Multer.File) {
    const ctx = await this.ctx(user);
    if (!file?.buffer) throw new BadRequestException('Document file is required');
    const project = await this.project(ctx, dto.projectId);
    if (dto.milestoneId) await this.requireMilestone(project.id, dto.milestoneId);
    const uploaded = await this.cloudinary.uploadProjectDocument({ tenantId: ctx.tenantId, projectId: project.id, userId: ctx.userId, buffer: file.buffer, mimeType: file.mimetype, fileName: file.originalname });
    const created = await this.prisma.projectDocument.create({
      data: { tenantId: ctx.tenantId, departmentId: ctx.departmentId, projectId: project.id, milestoneId: dto.milestoneId ?? null, uploadedByUserId: ctx.userId, name: file.originalname, description: dto.description ?? null, type: this.docType(file.mimetype, file.originalname), status: ProjectDocumentStatus.PENDING_REVIEW, fileUrl: uploaded.secureUrl, filePublicId: uploaded.publicId, resourceType: uploaded.resourceType, mimeType: file.mimetype, sizeBytes: file.size },
      include: { project: true, uploadedBy: true, reviewedBy: true },
    });
    return this.mapDocumentDetail(created);
  }

  async approveDocument(user: RequestUser, documentId: string, dto: ReviewProjectDocumentDto) {
    const ctx = await this.ctx(user);
    await this.document(ctx, documentId);
    const updated = await this.prisma.projectDocument.update({ where: { id: documentId }, data: { status: ProjectDocumentStatus.APPROVED, feedback: dto.feedback ?? null, reviewedAt: new Date(), reviewedByUserId: ctx.userId }, include: { project: true, uploadedBy: true, reviewedBy: true } });
    return this.mapDocumentDetail(updated);
  }

  async requestDocumentRevision(user: RequestUser, documentId: string, dto: ReviewProjectDocumentDto) {
    const ctx = await this.ctx(user);
    if (!dto.feedback?.trim()) throw new BadRequestException('feedback is required when requesting document revision');
    const document = await this.document(ctx, documentId);
    const updated = await this.prisma.projectDocument.update({ where: { id: document.id }, data: { status: ProjectDocumentStatus.REVISION_REQUIRED, feedback: dto.feedback, reviewedAt: new Date(), reviewedByUserId: ctx.userId }, include: { project: true, uploadedBy: true, reviewedBy: true } });
    const revision = await this.prisma.projectRevisionRequest.create({ data: { tenantId: ctx.tenantId, departmentId: ctx.departmentId, projectId: document.projectId, documentId: document.id, createdByUserId: ctx.userId, subject: `Revision required for ${document.name}`, feedback: dto.feedback } });
    return { document: this.mapDocumentDetail(updated), revisionRequest: { id: revision.id, subject: revision.subject, feedback: revision.feedback, status: String(revision.status).toLowerCase(), createdAt: revision.createdAt.toISOString() } };
  }

  async listSchedule(user: RequestUser, query: Record<string, string | undefined>) {
    const ctx = await this.ctx(user);
    const items = (await this.prisma.projectMeeting.findMany({ where: { tenantId: ctx.tenantId, departmentId: ctx.departmentId, advisorUserId: ctx.userId }, include: { project: { include: { members: { include: { user: true } } } } }, orderBy: { scheduledAt: 'asc' } }) as any[]).map((meeting) => this.mapMeeting(meeting));
    const date = String(query.date ?? '').trim();
    const filtered = items.filter((item) => !date || item.date === date);
    const confirmed = items.map((item: any) => item.attendees.filter((a: any) => a.status === 'confirmed').length);
    return { items: filtered, stats: { totalMeetings: items.length, virtualCount: items.filter((item: any) => item.type === 'virtual').length, inPersonCount: items.filter((item: any) => item.type === 'in-person').length, averageConfirmedAttendees: confirmed.length ? Math.round(confirmed.reduce((a: number, b: number) => a + b, 0) / confirmed.length) : 0 } };
  }

  async createMeeting(user: RequestUser, dto: CreateProjectMeetingDto) {
    const ctx = await this.ctx(user);
    const project = await this.project(ctx, dto.projectId);
    const created = await this.prisma.projectMeeting.create({ data: { tenantId: ctx.tenantId, departmentId: ctx.departmentId, projectId: project.id, advisorUserId: ctx.userId, title: dto.title, scheduledAt: this.when(dto.date, dto.time), durationMinutes: dto.durationMinutes ?? 60, type: dto.type ?? ProjectMeetingType.VIRTUAL, location: dto.location ?? null, agenda: dto.agenda ?? null, attendees: this.meetingAttendees(project.members ?? []) as Prisma.InputJsonValue }, include: { project: { include: { members: { include: { user: true } } } } } });
    return this.mapMeeting(created);
  }

  async updateMeeting(user: RequestUser, meetingId: string, dto: UpdateProjectMeetingDto) {
    const ctx = await this.ctx(user);
    const meeting = await this.meeting(ctx, meetingId);
    const updated = await this.prisma.projectMeeting.update({ where: { id: meeting.id }, data: { title: dto.title, scheduledAt: dto.date || dto.time ? this.when(dto.date ?? this.day(meeting.scheduledAt), dto.time ?? this.clock(meeting.scheduledAt)) : undefined, durationMinutes: dto.durationMinutes, type: dto.type, status: dto.status, location: dto.location, agenda: dto.agenda }, include: { project: { include: { members: { include: { user: true } } } } } });
    return this.mapMeeting(updated);
  }

  async deleteMeeting(user: RequestUser, meetingId: string) {
    const ctx = await this.ctx(user);
    const meeting = await this.meeting(ctx, meetingId);
    await this.prisma.projectMeeting.delete({ where: { id: meeting.id } });
    return { id: meeting.id, deletedAt: new Date().toISOString() };
  }

  async listAnnouncements(user: RequestUser, query: Record<string, string | undefined>) {
    const ctx = await this.ctx(user);
    const items = (await this.prisma.advisorAnnouncement.findMany({ where: { tenantId: ctx.tenantId, departmentId: ctx.departmentId, advisorUserId: ctx.userId }, orderBy: { createdAt: 'desc' } }) as any[]).map((announcement) => this.mapAnnouncement(announcement));
    const status = this.norm(query.status);
    const audience = this.norm(query.audience);
    const filtered = items.filter((item) => (!status || item.status === status) && (!audience || item.audience === audience));
    return { items: filtered, stats: { totalAnnouncements: items.length, publishedCount: items.filter((item: any) => item.status === 'published').length, draftCount: items.filter((item: any) => item.status === 'draft').length, archivedCount: items.filter((item: any) => item.status === 'archived').length } };
  }

  async createAnnouncement(user: RequestUser, dto: CreateAdvisorAnnouncementDto, file?: Express.Multer.File) {
    const ctx = await this.ctx(user);
    const targetProjectIds = Array.from(new Set(dto.targetProjectIds ?? []));
    if (targetProjectIds.length) {
      const count = await this.prisma.project.count({ where: { id: { in: targetProjectIds }, tenantId: ctx.tenantId, departmentId: ctx.departmentId, advisorId: ctx.userId } });
      if (count !== targetProjectIds.length) throw new BadRequestException('One or more target projects are invalid for this advisor');
    }
    const uploaded = file?.buffer ? await this.cloudinary.uploadAdvisorAnnouncementAttachment({ tenantId: ctx.tenantId, departmentId: ctx.departmentId, userId: ctx.userId, buffer: file.buffer, mimeType: file.mimetype, fileName: file.originalname }) : undefined;
    const created = await this.prisma.advisorAnnouncement.create({ data: { tenantId: ctx.tenantId, departmentId: ctx.departmentId, advisorUserId: ctx.userId, title: dto.title, content: dto.content, priority: dto.priority ?? AdvisorAnnouncementPriority.MEDIUM, status: dto.status ?? AdvisorAnnouncementStatus.PUBLISHED, audience: dto.audience ?? AdvisorAnnouncementAudience.STUDENTS, deadlineAt: dto.deadlineAt ? new Date(dto.deadlineAt) : null, targetProjectIds: targetProjectIds.length ? (targetProjectIds as Prisma.InputJsonValue) : Prisma.JsonNull, attachmentUrl: uploaded?.secureUrl ?? dto.attachmentUrl ?? null, attachmentPublicId: uploaded?.publicId ?? null, attachmentResourceType: uploaded?.resourceType ?? null, attachmentFileName: file?.originalname ?? null, attachmentMimeType: file?.mimetype ?? null, attachmentSizeBytes: file?.size ?? null } });
    return this.mapAnnouncement(created);
  }

  async listMessageGroups(user: RequestUser, query: Record<string, string | undefined>) {
    const ctx = await this.ctx(user);
    await this.ensureGroups(ctx);
    const items = await this.groupModels(ctx, await this.prisma.advisorMessageGroup.findMany({ where: { tenantId: ctx.tenantId, departmentId: ctx.departmentId, advisorUserId: ctx.userId }, include: { project: true, messages: { include: { sender: true }, orderBy: { createdAt: 'desc' }, take: 1 } }, orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }] }) as any[]);
    const search = this.norm(query.search);
    const filtered = items.filter((item) => !search || [item.name, item.project].some((v: string) => v.toLowerCase().includes(search)));
    return { items: filtered, stats: { totalGroups: items.length, totalMembers: items.reduce((t: number, g: any) => t + g.members.length, 0), unreadGroups: items.filter((g: any) => g.lastMessage?.unread).length } };
  }

  async createMessageGroup(user: RequestUser, dto: CreateAdvisorMessageGroupDto) {
    const ctx = await this.ctx(user);
    const project = dto.projectId ? await this.project(ctx, dto.projectId) : null;
    const memberUserIds = Array.from(new Set([ctx.userId, ...(dto.memberUserIds?.length ? dto.memberUserIds : project ? this.studentMembers(project).map((m: any) => m.userId) : [])]));
    const count = await this.prisma.user.count({ where: { id: { in: memberUserIds }, tenantId: ctx.tenantId, departmentId: ctx.departmentId, status: UserStatus.ACTIVE } });
    if (count !== memberUserIds.length) throw new BadRequestException('One or more group members are invalid');
    const created = await this.prisma.advisorMessageGroup.create({ data: { tenantId: ctx.tenantId, departmentId: ctx.departmentId, advisorUserId: ctx.userId, projectId: project?.id ?? dto.projectId ?? null, name: dto.name, description: dto.description ?? null, privacy: dto.privacy ?? (dto.projectId ? AdvisorMessageGroupPrivacy.PROJECT : AdvisorMessageGroupPrivacy.PRIVATE), memberUserIds: memberUserIds as Prisma.InputJsonValue }, include: { project: true, messages: { include: { sender: true }, orderBy: { createdAt: 'desc' }, take: 1 } } });
    return (await this.groupModels(ctx, [created as any]))[0];
  }

  async getMessageGroupById(user: RequestUser, groupId: string) {
    const ctx = await this.ctx(user);
    return (await this.groupModels(ctx, [await this.group(ctx, groupId)]))[0];
  }

  async listGroupMessages(user: RequestUser, groupId: string, query: Record<string, string | undefined>) {
    const ctx = await this.ctx(user);
    const group = await this.group(ctx, groupId);
    const take = Math.min(Math.max(Number(query.limit ?? 100) || 100, 1), 200);
    const items = await this.prisma.advisorMessage.findMany({ where: { tenantId: ctx.tenantId, departmentId: ctx.departmentId, groupId }, include: { sender: true }, orderBy: { createdAt: 'asc' }, take });
    return { group: (await this.groupModels(ctx, [group]))[0], items: items.map((message: any) => this.mapMessage(ctx, message)) };
  }

  async sendGroupMessage(user: RequestUser, groupId: string, dto: CreateAdvisorMessageDto) {
    const ctx = await this.ctx(user);
    const group = await this.group(ctx, groupId);
    const content = dto.content.trim();
    if (!content) throw new BadRequestException('content is required');
    const created = await this.prisma.$transaction(async (tx) => {
      const message = await tx.advisorMessage.create({ data: { tenantId: ctx.tenantId, departmentId: ctx.departmentId, groupId: group.id, senderUserId: ctx.userId, content, attachments: this.json(dto.attachments) ?? Prisma.JsonNull }, include: { sender: true } });
      await tx.advisorMessageGroup.update({ where: { id: group.id }, data: { lastMessageAt: message.createdAt } });
      return message;
    });
    return this.mapMessage(ctx, created);
  }

  private async ctx(user: RequestUser): Promise<AdvisorCtx> {
    if (!user?.sub) throw new ForbiddenException('Missing user context');
    const roles = Array.isArray(user.roles) ? user.roles : [];
    if (!roles.includes(ROLES.ADVISOR)) throw new ForbiddenException('Advisor access is required');
    const dbUser = await this.prisma.user.findUnique({ where: { id: user.sub }, include: { advisor: true } });
    if (!dbUser || dbUser.status !== UserStatus.ACTIVE) throw new ForbiddenException('Advisor account not found or inactive');
    if (!dbUser.departmentId) throw new BadRequestException('Advisor is not assigned to a department');
    if (!dbUser.advisor) throw new ForbiddenException('Advisor profile not found');
    return { userId: dbUser.id, tenantId: dbUser.tenantId, departmentId: dbUser.departmentId, fullName: this.fullName(dbUser) };
  }

  private projects(ctx: AdvisorCtx) {
    return this.prisma.project.findMany({
      where: { tenantId: ctx.tenantId, departmentId: ctx.departmentId, advisorId: ctx.userId },
      include: {
        proposal: { include: { submitter: true } },
        members: { include: { user: true } },
        milestones: { include: { documents: { orderBy: { createdAt: 'desc' }, take: 3 } }, orderBy: { dueDate: 'asc' } },
        documents: { include: { uploadedBy: true, reviewedBy: true }, orderBy: { createdAt: 'desc' } },
        meetings: { orderBy: { scheduledAt: 'asc' } },
        evaluations: { orderBy: { submittedAt: 'desc' } },
        revisionRequests: { orderBy: { createdAt: 'desc' } },
        advisorMessageGroups: { include: { messages: { include: { sender: true }, orderBy: { createdAt: 'desc' }, take: 5 } } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  private async project(ctx: AdvisorCtx, projectId: string) {
    const project = await this.prisma.project.findFirst({ where: { id: projectId, tenantId: ctx.tenantId, departmentId: ctx.departmentId, advisorId: ctx.userId }, include: { proposal: { include: { submitter: true } }, members: { include: { user: true } }, milestones: { include: { documents: { orderBy: { createdAt: 'desc' }, take: 3 } }, orderBy: { dueDate: 'asc' } }, documents: { include: { uploadedBy: true, reviewedBy: true }, orderBy: { createdAt: 'desc' } }, meetings: { orderBy: { scheduledAt: 'asc' } }, evaluations: { orderBy: { submittedAt: 'desc' } }, revisionRequests: { orderBy: { createdAt: 'desc' } }, advisorMessageGroups: { include: { messages: { include: { sender: true }, orderBy: { createdAt: 'desc' }, take: 5 } } } } });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  private async evaluation(ctx: AdvisorCtx, evaluationId: string) {
    const evaluation = await this.prisma.projectEvaluation.findFirst({ where: { id: evaluationId, tenantId: ctx.tenantId, departmentId: ctx.departmentId, advisorUserId: ctx.userId }, include: { project: { include: { proposal: { include: { submitter: true } } } }, studentUser: true, revisionRequests: true } });
    if (!evaluation) throw new NotFoundException('Evaluation not found');
    return evaluation;
  }

  private async document(ctx: AdvisorCtx, documentId: string) {
    const document = await this.prisma.projectDocument.findFirst({ where: { id: documentId, tenantId: ctx.tenantId, departmentId: ctx.departmentId, project: { is: { advisorId: ctx.userId } } }, include: { project: true, uploadedBy: true, reviewedBy: true, milestone: true, revisionRequests: true } });
    if (!document) throw new NotFoundException('Document not found');
    return document;
  }

  private async meeting(ctx: AdvisorCtx, meetingId: string) {
    const meeting = await this.prisma.projectMeeting.findFirst({ where: { id: meetingId, tenantId: ctx.tenantId, departmentId: ctx.departmentId, advisorUserId: ctx.userId }, include: { project: { include: { members: { include: { user: true } } } } } });
    if (!meeting) throw new NotFoundException('Meeting not found');
    return meeting;
  }

  private async group(ctx: AdvisorCtx, groupId: string) {
    const group = await this.prisma.advisorMessageGroup.findFirst({ where: { id: groupId, tenantId: ctx.tenantId, departmentId: ctx.departmentId, advisorUserId: ctx.userId }, include: { project: true, messages: { include: { sender: true }, orderBy: { createdAt: 'desc' }, take: 1 } } });
    if (!group) throw new NotFoundException('Message group not found');
    return group;
  }

  private async requireMilestone(projectId: string, milestoneId: string) {
    const milestone = await this.prisma.milestone.findFirst({ where: { id: milestoneId, projectId }, select: { id: true } });
    if (!milestone) throw new BadRequestException('Milestone does not belong to the selected project');
  }

  private async createRevision(ctx: AdvisorCtx, project: any, dto: CreateProjectRevisionRequestDto) {
    if (dto.milestoneId) await this.requireMilestone(project.id, dto.milestoneId);
    if (dto.documentId && !(await this.prisma.projectDocument.findFirst({ where: { id: dto.documentId, projectId: project.id }, select: { id: true } }))) throw new BadRequestException('Document does not belong to this project');
    if (dto.evaluationId && !(await this.prisma.projectEvaluation.findFirst({ where: { id: dto.evaluationId, projectId: project.id, advisorUserId: ctx.userId }, select: { id: true } }))) throw new BadRequestException('Evaluation does not belong to this project');
    const now = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      if (dto.milestoneId) await tx.milestone.update({ where: { id: dto.milestoneId }, data: { status: MilestoneStatus.REJECTED, feedback: dto.feedback } });
      if (dto.documentId) await tx.projectDocument.update({ where: { id: dto.documentId }, data: { status: ProjectDocumentStatus.REVISION_REQUIRED, feedback: dto.feedback, reviewedAt: now, reviewedByUserId: ctx.userId } });
      if (dto.evaluationId) await tx.projectEvaluation.update({ where: { id: dto.evaluationId }, data: { status: ProjectEvaluationStatus.NEEDS_REVISION, feedback: dto.feedback } });
      const revisionRequest = await tx.projectRevisionRequest.create({ data: { tenantId: ctx.tenantId, departmentId: ctx.departmentId, projectId: project.id, milestoneId: dto.milestoneId ?? null, documentId: dto.documentId ?? null, evaluationId: dto.evaluationId ?? null, createdByUserId: ctx.userId, subject: dto.subject, feedback: dto.feedback } });
      const updatedProject = await tx.project.update({ where: { id: project.id }, data: { clearanceStatus: ProjectClearanceStatus.REVISION_REQUIRED, advisorStatus: AdvisorProjectStatus.PENDING_REVIEW, clearanceNotes: dto.feedback } });
      return { revisionRequest, updatedProject };
    });
    return { id: result.revisionRequest.id, subject: result.revisionRequest.subject, feedback: result.revisionRequest.feedback, status: String(result.revisionRequest.status).toLowerCase(), createdAt: result.revisionRequest.createdAt.toISOString(), projectId: result.updatedProject.id, projectTitle: result.updatedProject.title };
  }

  private mapProject(project: any) {
    const messages = (project.advisorMessageGroups ?? []).flatMap((g: any) => g.messages ?? []).sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 6).map((message: any) => ({ id: message.id, sender: this.fullName(message.sender), content: message.content, timestamp: message.createdAt.toISOString(), read: message.senderUserId === project.advisorId }));
    const latest = (project.evaluations ?? [])[0];
    return {
      id: project.id,
      title: project.title,
      description: project.description ?? '',
      groupName: this.groupName(project),
      groupId: project.id,
      advisorId: project.advisorId,
      startDate: (project.startDate ?? project.createdAt).toISOString(),
      dueDate: (project.dueDate ?? project.updatedAt).toISOString(),
      status: this.projectStatus(project),
      progress: this.progress(project),
      members: this.studentMembers(project).map((member: any) => ({ id: member.userId, name: this.fullName(member.user), email: member.user.email, role: member.role === ProjectMemberRole.STUDENT ? 'Student' : member.role, avatar: member.user.avatarUrl ?? undefined, joinedAt: member.joinedAt.toISOString(), lastActive: member.user.updatedAt?.toISOString() ?? undefined })),
      milestones: (project.milestones ?? []).map((m: any) => ({ id: m.id, name: m.title, description: m.description ?? '', dueDate: m.dueDate.toISOString(), status: this.projectMilestoneStatus(m), completedDate: m.completedAt?.toISOString() ?? undefined, priority: this.low(String(m.priority ?? 'MEDIUM')), deliverables: this.strings(m.deliverables) })),
      documents: (project.documents ?? []).map((d: any) => ({ id: d.id, name: d.name, type: this.docTypeLabel(d.type), size: this.bytes(d.sizeBytes), uploadedAt: d.createdAt.toISOString(), uploadedBy: this.fullName(d.uploadedBy) })),
      meetings: (project.meetings ?? []).map((meeting: any) => { const mapped = this.mapMeeting(meeting, project.members ?? []); return { id: mapped.id, title: mapped.title, date: mapped.date, time: mapped.time, attendees: mapped.attendees.map((a: any) => a.name) }; }),
      messages,
      evaluation: latest ? this.rubric(latest.rubric).map((r) => ({ criteria: r.label, score: r.score, maxScore: r.max, comments: r.description ?? latest.feedback ?? '' })) : [],
      category: project.category ?? project.projectType ?? 'General',
      tags: this.strings(project.tags),
      technologies: this.strings(project.technologies),
    };
  }

  private mapClearanceProject(project: any) {
    const latest = (project.evaluations ?? [])[0];
    return {
      id: project.id,
      title: project.title,
      groupName: this.groupName(project),
      progress: this.progress(project),
      status: this.clearance(project),
      submittedAt: this.submitted(project).toISOString(),
      clearedAt: project.clearedAt?.toISOString() ?? undefined,
      milestones: (project.milestones ?? []).map((m: any) => ({ id: m.id, name: m.title, status: this.studentMilestoneStatus(m), submittedAt: (m.submittedAt ?? m.updatedAt ?? m.dueDate).toISOString() })),
      members: this.studentMembers(project).map((member: any) => ({ id: member.userId, name: this.fullName(member.user), role: member.role === ProjectMemberRole.STUDENT ? 'Student' : member.role, avatar: member.user.avatarUrl ?? undefined })),
      evaluationCriteria: this.criteria(latest?.rubric),
    };
  }

  private mapEvaluationRow(evaluation: any) {
    const detail = this.mapEvaluationDetail(evaluation);
    return { id: detail.id, studentName: detail.studentName, studentId: detail.studentId, projectTitle: detail.projectTitle, projectType: detail.projectType, status: detail.status, submittedDate: detail.submittedDate, dueDate: detail.dueDate, score: detail.score, maxScore: detail.maxScore, priority: detail.priority, feedbackCount: detail.feedbackCount };
  }

  private mapEvaluationDetail(evaluation: any) {
    const rubric = this.rubric(evaluation.rubric);
    const score = this.rubricScore(rubric);
    const student = evaluation.studentUser ?? evaluation.project?.proposal?.submitter ?? this.firstStudent(evaluation.project);
    return { id: evaluation.id, studentName: student ? this.fullName(student) : 'Student', studentId: student?.id ?? null, projectTitle: evaluation.project?.title ?? 'Untitled Project', projectType: evaluation.projectType ?? evaluation.project?.projectType ?? undefined, submittedDate: evaluation.submittedAt.toISOString(), dueDate: evaluation.dueDate?.toISOString() ?? undefined, status: this.evalStatus(evaluation.status), summary: evaluation.summary ?? '', rubric, attachments: this.attachments(evaluation.attachments), feedback: evaluation.feedback ?? undefined, grade: evaluation.grade ?? undefined, priority: this.title(String(evaluation.priority ?? ProjectEvaluationPriority.MEDIUM).toLowerCase()), feedbackCount: (evaluation.revisionRequests ?? []).length, score: score.score, maxScore: score.maxScore };
  }

  private mapDocumentRow(document: any) {
    return { id: document.id, name: document.name, type: this.docTypeLabel(document.type), size: this.bytes(document.sizeBytes), uploadedBy: this.fullName(document.uploadedBy), uploadedAt: document.createdAt.toISOString(), project: document.project?.title ?? 'Untitled Project', group: document.project ? this.groupName(document.project) : 'Project Team', status: this.docStatus(document.status), description: document.description ?? '' };
  }

  private mapDocumentDetail(document: any) {
    const base = this.mapDocumentRow(document);
    return { ...base, fileUrl: document.fileUrl, filePublicId: document.filePublicId, resourceType: document.resourceType, mimeType: document.mimeType ?? undefined, sizeBytes: document.sizeBytes ?? undefined, uploadedById: document.uploadedByUserId, reviewedBy: document.reviewedBy ? this.fullName(document.reviewedBy) : undefined, reviewedAt: document.reviewedAt?.toISOString() ?? undefined, feedback: document.feedback ?? undefined, milestoneId: document.milestoneId ?? undefined, projectId: document.projectId };
  }

  private mapMeeting(meeting: any, members?: any[]) {
    return { id: meeting.id, title: meeting.title, project: meeting.project?.title ?? 'Untitled Project', date: this.day(meeting.scheduledAt), time: this.clock(meeting.scheduledAt), durationMinutes: meeting.durationMinutes, type: meeting.type === ProjectMeetingType.IN_PERSON ? 'in-person' : 'virtual', location: meeting.location ?? '', attendees: this.attendeeModels(meeting.attendees, members ?? meeting.project?.members ?? []), agenda: meeting.agenda ?? '', status: this.low(String(meeting.status ?? ProjectMeetingStatus.SCHEDULED)) };
  }

  private mapAnnouncement(announcement: any) {
    return { id: announcement.id, title: announcement.title, content: announcement.content, priority: this.low(String(announcement.priority ?? AdvisorAnnouncementPriority.MEDIUM)), status: this.low(String(announcement.status ?? AdvisorAnnouncementStatus.PUBLISHED)), audience: this.low(String(announcement.audience ?? AdvisorAnnouncementAudience.STUDENTS)), createdAt: announcement.createdAt.toISOString(), updatedAt: announcement.updatedAt.toISOString(), deadlineAt: announcement.deadlineAt?.toISOString() ?? null, targetProjectIds: this.strings(announcement.targetProjectIds), attachmentUrl: announcement.attachmentUrl ?? null, attachmentFileName: announcement.attachmentFileName ?? null, attachmentMimeType: announcement.attachmentMimeType ?? null, attachmentSizeBytes: announcement.attachmentSizeBytes ?? null };
  }

  private mapMessage(ctx: AdvisorCtx, message: any) {
    return { id: message.id, sender: this.fullName(message.sender), content: message.content, timestamp: message.createdAt.toISOString(), type: 'text', isOwn: message.senderUserId === ctx.userId, attachments: this.messageAttachments(message.attachments) };
  }

  private async groupModels(ctx: AdvisorCtx, groups: any[]) {
    const ids = new Set<string>();
    for (const group of groups) for (const id of this.strings(group.memberUserIds)) ids.add(id);
    const users = ids.size ? await this.prisma.user.findMany({ where: { id: { in: Array.from(ids) }, tenantId: ctx.tenantId } }) : [];
    const map = new Map<string, any>();
    for (const user of users as any[]) map.set(user.id, user);
    return groups.map((group) => ({ id: group.id, name: group.name, project: group.project?.title ?? group.description ?? 'Advisor Group', description: group.description ?? '', privacy: this.low(String(group.privacy ?? AdvisorMessageGroupPrivacy.PRIVATE)), members: this.strings(group.memberUserIds).map((id) => map.get(id)).filter(Boolean).map((user: any) => ({ id: user.id, name: this.fullName(user), role: user.id === ctx.userId ? 'Advisor' : 'Student', avatar: user.avatarUrl ?? '', status: user.id === ctx.userId ? 'online' : 'offline' })), lastMessage: group.messages?.[0] ? { sender: this.fullName(group.messages[0].sender), content: group.messages[0].content, timestamp: group.messages[0].createdAt.toISOString(), unread: group.messages[0].senderUserId !== ctx.userId } : { sender: ctx.fullName, content: 'No messages yet', timestamp: group.createdAt.toISOString(), unread: false } }));
  }

  private async ensureGroups(ctx: AdvisorCtx) {
    const projects = await this.prisma.project.findMany({ where: { tenantId: ctx.tenantId, departmentId: ctx.departmentId, advisorId: ctx.userId }, select: { id: true, title: true, groupName: true, members: { where: { role: ProjectMemberRole.STUDENT }, select: { userId: true } }, advisorMessageGroups: { select: { id: true } } } });
    for (const project of projects as any[]) {
      if ((project.advisorMessageGroups ?? []).length) continue;
      const memberUserIds = Array.from(new Set([ctx.userId, ...(project.members ?? []).map((m: any) => m.userId)]));
      await this.prisma.advisorMessageGroup.create({ data: { tenantId: ctx.tenantId, departmentId: ctx.departmentId, advisorUserId: ctx.userId, projectId: project.id, name: `${project.groupName ?? project.title} Team`, privacy: AdvisorMessageGroupPrivacy.PROJECT, memberUserIds: memberUserIds as Prisma.InputJsonValue } });
    }
  }

  private studentMembers(project: any) { return (project.members ?? []).filter((m: any) => m.role === ProjectMemberRole.STUDENT); }
  private firstStudent(project: any) { return this.studentMembers(project)[0]?.user ?? null; }
  private primaryStudentName(project: any) { const student = project.proposal?.submitter ?? this.firstStudent(project); return student ? this.fullName(student) : 'Student Team'; }
  private groupName(project: any) { if (String(project.groupName ?? '').trim()) return String(project.groupName).trim(); const names = this.studentMembers(project).map((m: any) => this.fullName(m.user)); return !names.length ? 'Project Team' : names.length === 1 ? names[0] : `${names[0]} +${names.length - 1}`; }
  private submitted(project: any) { const dates = (project.milestones ?? []).map((m: any) => m.submittedAt).filter(Boolean).sort((a: Date, b: Date) => b.getTime() - a.getTime()); return dates[0] ?? project.updatedAt ?? project.createdAt; }
  private progress(project: any) { if (typeof project.progressPercent === 'number') return this.clamp(project.progressPercent); if (project.clearanceStatus === ProjectClearanceStatus.CLEARED) return 100; const milestones = project.milestones ?? []; if (!milestones.length) return 0; const score = milestones.reduce((s: number, m: any) => s + (m.status === MilestoneStatus.APPROVED ? 1 : m.status === MilestoneStatus.SUBMITTED ? 0.7 : m.status === MilestoneStatus.REJECTED ? 0.3 : 0.1), 0); return this.clamp(Math.round((score / milestones.length) * 100)); }
  private projectStatus(project: any) { if (project.clearanceStatus === ProjectClearanceStatus.CLEARED) return 'cleared'; if (project.status === ProjectStatus.COMPLETED || project.advisorStatus === AdvisorProjectStatus.COMPLETED) return 'completed'; if (project.advisorStatus === AdvisorProjectStatus.ON_HOLD) return 'on-hold'; if (project.advisorStatus === AdvisorProjectStatus.PENDING_REVIEW || (project.milestones ?? []).some((m: any) => m.status === MilestoneStatus.SUBMITTED) || (project.documents ?? []).some((d: any) => d.status === ProjectDocumentStatus.PENDING_REVIEW) || (project.evaluations ?? []).some((e: any) => e.status === ProjectEvaluationStatus.PENDING_REVIEW)) return 'pending-review'; if (project.advisorStatus === AdvisorProjectStatus.IN_PROGRESS || this.progress(project) > 0) return 'in-progress'; return 'active'; }
  private clearance(project: any) { if (project.clearanceStatus === ProjectClearanceStatus.CLEARED) return 'cleared'; if (project.clearanceStatus === ProjectClearanceStatus.REVISION_REQUIRED || (project.revisionRequests ?? []).some((r: any) => String(r.status) === 'OPEN')) return 'revision_required'; const milestones = project.milestones ?? []; return project.clearanceStatus === ProjectClearanceStatus.READY_FOR_CLEARANCE || (milestones.length && milestones.every((m: any) => m.status === MilestoneStatus.APPROVED)) || milestones.some((m: any) => m.status === MilestoneStatus.SUBMITTED) ? 'ready_for_clearance' : 'revision_required'; }
  private proposalStatus(status: ProposalStatus) { return status === ProposalStatus.APPROVED ? 'Approved' : status === ProposalStatus.REJECTED ? 'Rejected' : status === ProposalStatus.SUBMITTED ? 'Pending' : 'Needs Revision'; }
  private milestoneReviewStatus(m: any) { return m.status === MilestoneStatus.APPROVED ? 'Approved' : m.status === MilestoneStatus.REJECTED ? 'Rejected' : m.status === MilestoneStatus.SUBMITTED ? 'Pending Review' : 'Upcoming'; }
  private projectMilestoneStatus(m: any) { return m.status === MilestoneStatus.APPROVED ? 'approved' : m.status === MilestoneStatus.SUBMITTED ? 'submitted' : m.status === MilestoneStatus.REJECTED ? 'overdue' : m.completedAt ? 'completed' : m.dueDate.getTime() < Date.now() ? 'overdue' : 'pending'; }
  private studentMilestoneStatus(m: any) { return m.status === MilestoneStatus.APPROVED ? 'approved' : m.status === MilestoneStatus.SUBMITTED ? 'submitted' : 'revision'; }
  private evalStatus(status: ProjectEvaluationStatus) { return status === ProjectEvaluationStatus.EVALUATED ? 'Evaluated' : status === ProjectEvaluationStatus.NEEDS_REVISION ? 'Needs Revision' : 'Pending Review'; }
  private docStatus(status: ProjectDocumentStatus) { return status === ProjectDocumentStatus.APPROVED ? 'approved' : status === ProjectDocumentStatus.REVISION_REQUIRED ? 'revision_required' : 'pending_review'; }
  private docTypeLabel(type: ProjectDocumentType) { return String(type).toLowerCase(); }
  private criteria(rubric: Prisma.JsonValue | null | undefined) { if (rubric && typeof rubric === 'object' && !Array.isArray(rubric)) { const r = rubric as Record<string, unknown>; const t = this.num(r.technical), p = this.num(r.presentation), d = this.num(r.documentation), i = this.num(r.innovation); if (t !== null || p !== null || d !== null || i !== null) return { technical: t ?? 0, presentation: p ?? 0, documentation: d ?? 0, innovation: i ?? 0 }; } const items = this.rubric(rubric).slice(0, 4); const keys = ['technical', 'presentation', 'documentation', 'innovation'] as const; const out = { technical: 0, presentation: 0, documentation: 0, innovation: 0 }; items.forEach((item, index) => { const key = keys[index]; out[key] = item.max > 0 ? Math.round((item.score / item.max) * 100) : 0; }); return out; }
  private rubric(value: Prisma.JsonValue | null | undefined) { if (Array.isArray(value)) return value.map((entry, index) => this.rubricEntry(entry, index)).filter(Boolean) as Array<{ id: string; label: string; description?: string; max: number; score: number }>; if (value && typeof value === 'object') return Object.entries(value as Record<string, unknown>).map(([key, raw], index) => raw && typeof raw === 'object' ? { id: String((raw as Record<string, unknown>).id ?? `rubric-${index + 1}`), label: String((raw as Record<string, unknown>).label ?? this.title(key)), description: typeof (raw as Record<string, unknown>).description === 'string' ? String((raw as Record<string, unknown>).description) : undefined, max: this.num((raw as Record<string, unknown>).max ?? (raw as Record<string, unknown>).maxScore) ?? 10, score: this.num((raw as Record<string, unknown>).score ?? (raw as Record<string, unknown>).value) ?? 0 } : this.num(raw) === null ? null : { id: `rubric-${index + 1}`, label: this.title(key), max: 100, score: this.num(raw) ?? 0 }).filter(Boolean) as Array<{ id: string; label: string; description?: string; max: number; score: number }>; return []; }
  private rubricEntry(entry: unknown, index: number) { if (!entry || typeof entry !== 'object') return null; const r = entry as Record<string, unknown>; return { id: String(r.id ?? `rubric-${index + 1}`), label: String(r.label ?? r.title ?? `Criteria ${index + 1}`), description: typeof r.description === 'string' ? r.description : undefined, max: this.num(r.max ?? r.maxScore) ?? 10, score: this.num(r.score ?? r.value) ?? 0 }; }
  private rubricScore(items: Array<{ max: number; score: number }>) { return items.length ? { score: items.reduce((t, i) => t + i.score, 0), maxScore: items.reduce((t, i) => t + i.max, 0) } : {}; }
  private attachments(value: Prisma.JsonValue | null | undefined) { if (!value) return []; const entries = Array.isArray(value) ? value : [value]; return entries.map((entry) => { if (!entry || typeof entry !== 'object') return null; const r = entry as Record<string, unknown>; const url = typeof r.url === 'string' ? r.url : null; const name = typeof r.name === 'string' ? r.name : url; return url && name ? { name, url } : null; }).filter(Boolean) as Array<{ name: string; url: string }>; }
  private messageAttachments(value: Prisma.JsonValue | null | undefined) { if (!value) return undefined; const entries = Array.isArray(value) ? value : [value]; const out = entries.map((entry) => { if (!entry || typeof entry !== 'object') return null; const r = entry as Record<string, unknown>; const mime = typeof r.mimeType === 'string' ? r.mimeType : ''; return { name: typeof r.name === 'string' ? r.name : 'Attachment', size: this.num(r.size) !== null ? this.bytes(this.num(r.size) ?? 0) : undefined, type: mime.includes('pdf') ? 'pdf' : mime.startsWith('image/') ? 'image' : 'other' as 'pdf' | 'image' | 'other' }; }).filter(Boolean) as Array<{ name: string; size?: string; type: 'pdf' | 'image' | 'other' }>; return out.length ? out : undefined; }
  private attendeeModels(attendees: Prisma.JsonValue | null | undefined, fallback: any[]) { if (Array.isArray(attendees) && attendees.length) return attendees.map((entry, index) => { if (!entry || typeof entry !== 'object') return null; const r = entry as Record<string, unknown>; const status = ['confirmed', 'pending', 'declined'].includes(String(r.status ?? '').toLowerCase()) ? String(r.status).toLowerCase() as 'confirmed' | 'pending' | 'declined' : 'pending'; return { id: String(r.id ?? r.userId ?? `attendee-${index + 1}`), name: String(r.name ?? 'Student'), role: String(r.role ?? 'Student'), status, avatar: typeof r.avatar === 'string' ? r.avatar : undefined }; }).filter(Boolean) as Array<{ id: string; name: string; role: string; status: 'confirmed' | 'pending' | 'declined'; avatar?: string }>; return fallback.filter((m) => m.role === ProjectMemberRole.STUDENT).map((m) => ({ id: m.userId, name: this.fullName(m.user), role: 'Student', status: 'pending' as const, avatar: m.user.avatarUrl ?? undefined })); }
  private meetingAttendees(members: any[]) { return members.filter((m) => m.role === ProjectMemberRole.STUDENT).map((m) => ({ id: m.userId, userId: m.userId, name: this.fullName(m.user), role: 'Student', status: 'pending', avatar: m.user.avatarUrl ?? undefined })); }
  private fullName(user: any) { const name = [String(user?.firstName ?? '').trim(), String(user?.lastName ?? '').trim()].filter(Boolean).join(' ').trim(); return name || String(user?.email ?? 'Unknown User'); }
  private strings(value: Prisma.JsonValue | null | undefined) { if (!value) return []; if (Array.isArray(value)) return value.map((v) => String(v ?? '').trim()).filter(Boolean); if (typeof value === 'string') { const t = value.trim(); if (!t) return []; if (t.startsWith('[')) try { const parsed = JSON.parse(t) as unknown; if (Array.isArray(parsed)) return parsed.map((v) => String(v ?? '').trim()).filter(Boolean); } catch {} return t.split(',').map((v) => v.trim()).filter(Boolean); } return []; }
  private firstUrl(value: Prisma.JsonValue | null | undefined) { return this.attachments(value)[0]?.url; }
  private json(value: unknown) { if (value === undefined || value === null || value === '') return undefined; if (typeof value === 'string') { const t = value.trim(); if (!t) return undefined; try { return JSON.parse(t) as Prisma.InputJsonValue; } catch { return [{ name: t }] as unknown as Prisma.InputJsonValue; } } return value as Prisma.InputJsonValue; }
  private docType(mime: string, name: string) { const m = mime.toLowerCase(); const n = name.toLowerCase(); return m === 'application/pdf' || n.endsWith('.pdf') ? ProjectDocumentType.PDF : m === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || n.endsWith('.docx') ? ProjectDocumentType.DOCX : m.startsWith('image/') ? ProjectDocumentType.IMAGE : m.startsWith('video/') ? ProjectDocumentType.VIDEO : m === 'application/zip' || m === 'application/x-zip-compressed' || n.endsWith('.zip') ? ProjectDocumentType.ZIP : ProjectDocumentType.OTHER; }
  private bytes(size: number | null | undefined) { if (typeof size !== 'number' || size <= 0) return '0 B'; const units = ['B', 'KB', 'MB', 'GB']; let value = size; let i = 0; while (value >= 1024 && i < units.length - 1) { value /= 1024; i += 1; } const fixed = value >= 10 || i === 0 ? value.toFixed(0) : value.toFixed(1); return `${fixed} ${units[i]}`; }
  private clamp(value: number) { return Math.max(0, Math.min(100, Math.round(value))); }
  private num(value: unknown) { const n = Number(value); return Number.isFinite(n) ? n : null; }
  private title(value: string) { return value.replace(/[_-]+/g, ' ').split(' ').filter(Boolean).map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' '); }
  private low(value: string) { return String(value).trim().toLowerCase(); }
  private norm(value?: string) { return String(value ?? '').trim().toLowerCase(); }
  private day(date: Date) { return date.toISOString().slice(0, 10); }
  private clock(date: Date) { return date.toISOString().slice(11, 16); }
  private when(date: string, time: string) { const out = new Date(`${date}T${time}:00`); if (Number.isNaN(out.getTime())) throw new BadRequestException('Invalid meeting date or time'); return out; }
}
