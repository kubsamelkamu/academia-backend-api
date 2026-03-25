import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GroupLeaderRequestStatus,
  ProjectGroupAnnouncementAttachmentResourceType,
  ProjectGroupAnnouncementAttachmentType,
  ProjectGroupAnnouncementPriority,
  ProjectGroupInvitationStatus,
  ProjectGroupJoinRequestStatus,
  ProjectGroupStatus,
  Prisma,
} from '@prisma/client';
import { randomBytes } from 'crypto';

import { ROLES } from '../../common/constants/roles.constants';
import {
  InsufficientPermissionsException,
  UnauthorizedAccessException,
} from '../../common/exceptions';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../core/email/email.service';
import { QueueService } from '../../core/queue/queue.service';
import { CloudinaryService } from '../../core/storage/cloudinary.service';
import { AuthRepository } from '../auth/auth.repository';
import { NotificationGateway } from '../notification/notification.gateway';

import { CreateProjectGroupDto } from './dto/create-project-group.dto';
import { CreateProjectGroupInvitationDto } from './dto/create-project-group-invitation.dto';
import { BrowseProjectGroupsQueryDto } from './dto/browse-project-groups.query.dto';
import { CreateProjectGroupJoinRequestDto } from './dto/create-project-group-join-request.dto';
import { DecideProjectGroupJoinRequestDto } from './dto/decide-project-group-join-request.dto';
import { DecideProjectGroupReviewDto } from './dto/decide-project-group-review.dto';
import { ListAvailableStudentsQueryDto } from './dto/list-available-students.query.dto';
import { ListJoinRequestsQueryDto } from './dto/list-join-requests.query.dto';
import { ListSubmittedProjectGroupsQueryDto } from './dto/list-submitted-project-groups.query.dto';
import {
  PROJECT_GROUP_ANNOUNCEMENT_PRIORITIES,
  type ProjectGroupAnnouncementPriority as DtoAnnouncementPriority,
} from './dto/create-project-group-announcement.dto';
import { CreateProjectGroupAnnouncementDto } from './dto/create-project-group-announcement.dto';
import { UpdateProjectGroupAnnouncementDto } from './dto/update-project-group-announcement.dto';
import { ListProjectGroupAnnouncementsQueryDto } from './dto/list-project-group-announcements.query.dto';
import { ProjectGroupRepository } from './project-group.repository';
import { PreviewProjectGroupInvitationEmailDto } from './dto/preview-project-group-invitation-email.dto';
import { buildProjectGroupInvitationEmailContent } from './project-group-invitation-email-content';

const DEFAULT_MIN_GROUP_SIZE = 3;
const DEFAULT_MAX_GROUP_SIZE = 5;

@Injectable()
export class ProjectGroupService {
  private readonly logger = new Logger(ProjectGroupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
    private readonly queueService: QueueService,
    private readonly cloudinary: CloudinaryService,
    private readonly authRepository: AuthRepository,
    private readonly projectGroupRepository: ProjectGroupRepository,
    private readonly notificationGateway: NotificationGateway
  ) {}

  private parseAnnouncementPriority(
    value: DtoAnnouncementPriority
  ): ProjectGroupAnnouncementPriority {
    const normalized = String(value ?? '')
      .trim()
      .toUpperCase();
    if (!PROJECT_GROUP_ANNOUNCEMENT_PRIORITIES.includes(normalized as any)) {
      throw new BadRequestException('Invalid priority');
    }
    return normalized as ProjectGroupAnnouncementPriority;
  }

  private async emitAnnouncementRealtime(params: {
    projectGroupId: string;
    actorUserId: string;
    type: 'created' | 'updated' | 'deleted';
    announcement?: any;
    announcementId?: string;
  }): Promise<void> {
    try {
      const server = (this.notificationGateway as any)?.server;
      if (!server) return;

      const userIds = await this.projectGroupRepository.listProjectGroupUserIds(
        params.projectGroupId
      );
      const recipientIds = userIds.filter((id) => id && id !== params.actorUserId);
      if (!recipientIds.length) return;

      this.notificationGateway.emitEventToUsers(recipientIds, 'project-group-announcement', {
        type: params.type,
        projectGroupId: params.projectGroupId,
        announcementId: params.announcementId ?? params.announcement?.id,
        announcement: params.announcement,
        occurredAt: new Date().toISOString(),
      });
    } catch {
      // best-effort
    }
  }

  private async requireApprovedMyGroupForLeader(user: any) {
    const dbUser = await this.requireApprovedGroupLeader(user);

    const group = await this.projectGroupRepository.findMyGroupForLeader(dbUser.id);
    if (!group) {
      throw new BadRequestException('Group not found for this leader');
    }

    if (group.status !== ProjectGroupStatus.APPROVED) {
      throw new BadRequestException('Group is not approved yet');
    }

    return { dbUser, group };
  }

  private async requireApprovedMyGroupForStudent(user: any) {
    const dbUser = await this.requireStudentInDepartment(user);

    const group = await this.projectGroupRepository.findMyGroupBasicForStudent({
      tenantId: dbUser.tenantId,
      departmentId: dbUser.departmentId,
      userId: dbUser.id,
    });

    if (!group) {
      throw new BadRequestException('Group not found for this student');
    }

    if (group.status !== ProjectGroupStatus.APPROVED) {
      throw new BadRequestException('Group is not approved yet');
    }

    return { dbUser, group };
  }

  private async requireDbUser(user: any) {
    if (!user?.sub) {
      throw new UnauthorizedAccessException();
    }

    const dbUser = await this.authRepository.findUserById(user.sub);
    if (!dbUser) {
      throw new UnauthorizedAccessException();
    }

    if (user.tenantId && user.tenantId !== 'system' && dbUser.tenantId !== user.tenantId) {
      throw new UnauthorizedAccessException();
    }

    return dbUser;
  }

  private async requireApprovedGroupLeader(user: any) {
    const dbUser = await this.requireDbUser(user);

    const roles: string[] = user?.roles ?? [];
    if (!roles.includes(ROLES.STUDENT)) {
      throw new InsufficientPermissionsException('Only students can perform this action');
    }

    if (!dbUser.departmentId) {
      throw new BadRequestException('Student is not assigned to a department');
    }

    const departmentId = dbUser.departmentId;

    const glr = await this.prisma.groupLeaderRequest.findUnique({
      where: { studentUserId: dbUser.id },
      select: { status: true },
    });

    if (!glr || glr.status !== GroupLeaderRequestStatus.APPROVED) {
      throw new InsufficientPermissionsException(
        'Only approved group leaders can perform this action'
      );
    }

    return {
      ...dbUser,
      departmentId,
    };
  }

  private async requireStudentInDepartment(user: any) {
    const dbUser = await this.requireDbUser(user);

    const roles: string[] = user?.roles ?? [];
    if (!roles.includes(ROLES.STUDENT)) {
      throw new InsufficientPermissionsException('Only students can perform this action');
    }

    if (!dbUser.departmentId) {
      throw new BadRequestException('Student is not assigned to a department');
    }

    return {
      ...dbUser,
      departmentId: dbUser.departmentId,
    };
  }

  private async requireDepartmentReviewer(user: any) {
    const dbUser = await this.requireDbUser(user);

    const roles: string[] = user?.roles ?? [];
    if (!roles.includes(ROLES.DEPARTMENT_HEAD) && !roles.includes(ROLES.COORDINATOR)) {
      throw new InsufficientPermissionsException(
        'Only department head or coordinator can perform this action'
      );
    }

    if (!dbUser.departmentId) {
      throw new BadRequestException('User is not assigned to a department');
    }

    return {
      ...dbUser,
      departmentId: dbUser.departmentId,
    };
  }

  private normalizeBaseUrl(value: string) {
    return (value || '').replace(/\/+$/, '');
  }

  private buildApiUrl(path: string) {
    const appUrl = this.normalizeBaseUrl(
      this.config.get<string>('app.url') || 'http://localhost:3001'
    );
    const apiPrefix = (this.config.get<string>('app.apiPrefix') || 'api').replace(/^\/+|\/+$/g, '');
    const apiVersion = (this.config.get<string>('app.apiVersion') || 'v1').replace(
      /^\/+|\/+$/g,
      ''
    );
    const cleanPath = path.replace(/^\/+/, '');
    return `${appUrl}/${apiPrefix}/${apiVersion}/${cleanPath}`;
  }

  private resolveAvatarUrl(params: { avatarUrl?: string | null; fullName?: string }) {
    const explicitAvatar = (params.avatarUrl ?? '').trim();
    if (explicitAvatar) {
      return explicitAvatar;
    }

    const configuredDefault =
      this.config.get<string>('email.defaultAvatarUrl') || process.env.EMAIL_DEFAULT_AVATAR_URL;
    if (configuredDefault?.trim()) {
      return configuredDefault.trim();
    }

    const name = (params.fullName ?? '').trim() || 'User';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(
      name
    )}&background=2563eb&color=ffffff&size=128&bold=true`;
  }

  private async getDepartmentMaxGroupSize(departmentId: string): Promise<number> {
    const { maxGroupSize } = await this.getDepartmentGroupSizeSetting(departmentId);
    return maxGroupSize;
  }

  private async getDepartmentGroupSizeSetting(
    departmentId: string
  ): Promise<{ minGroupSize: number; maxGroupSize: number }> {
    const setting = await this.prisma.departmentGroupSizeSetting.findUnique({
      where: { departmentId },
      select: { minGroupSize: true, maxGroupSize: true },
    });

    return {
      minGroupSize: setting?.minGroupSize ?? DEFAULT_MIN_GROUP_SIZE,
      maxGroupSize: setting?.maxGroupSize ?? DEFAULT_MAX_GROUP_SIZE,
    };
  }

  private parseJoinRequestStatus(value?: string): ProjectGroupJoinRequestStatus | undefined {
    if (!value) return undefined;
    const normalized = String(value).trim().toUpperCase();
    const allowed = Object.values(ProjectGroupJoinRequestStatus) as string[];
    if (!allowed.includes(normalized)) {
      throw new BadRequestException('Invalid status filter');
    }
    return normalized as ProjectGroupJoinRequestStatus;
  }

  async createAnnouncementForMyGroupLeader(
    user: any,
    dto: CreateProjectGroupAnnouncementDto,
    file?: Express.Multer.File
  ) {
    const { dbUser, group } = await this.requireApprovedMyGroupForLeader(user);

    const hasFile = !!file?.buffer;
    const hasLink = !!dto.attachmentUrl;
    if (hasFile && hasLink) {
      throw new BadRequestException('Provide either a file or attachmentUrl, not both');
    }

    const priority = this.parseAnnouncementPriority(dto.priority);

    if (hasFile) {
      const uploaded = await this.cloudinary.uploadProjectGroupAnnouncementAttachment({
        tenantId: group.tenantId,
        projectGroupId: group.id,
        userId: dbUser.id,
        buffer: file!.buffer,
        mimeType: file!.mimetype,
        fileName: file!.originalname,
      });

      try {
        const announcement = await this.projectGroupRepository.createAnnouncement({
          tenantId: group.tenantId,
          departmentId: group.departmentId,
          projectGroupId: group.id,
          createdByUserId: dbUser.id,
          title: dto.title,
          priority,
          message: dto.message,
          attachmentType: ProjectGroupAnnouncementAttachmentType.FILE,
          attachmentUrl: uploaded.secureUrl,
          attachmentPublicId: uploaded.publicId,
          attachmentResourceType:
            uploaded.resourceType === 'image'
              ? ProjectGroupAnnouncementAttachmentResourceType.image
              : ProjectGroupAnnouncementAttachmentResourceType.raw,
          attachmentFileName: file!.originalname,
          attachmentMimeType: file!.mimetype,
          attachmentSizeBytes: typeof file!.size === 'number' ? file!.size : undefined,
        });

        void this.emitAnnouncementRealtime({
          projectGroupId: group.id,
          actorUserId: dbUser.id,
          type: 'created',
          announcement,
        });

        return announcement;
      } catch (err) {
        try {
          await this.cloudinary.deleteByPublicId(uploaded.publicId, uploaded.resourceType);
        } catch {
          // ignore cleanup failure
        }
        throw err;
      }
    }

    const announcement = await this.projectGroupRepository.createAnnouncement({
      tenantId: group.tenantId,
      departmentId: group.departmentId,
      projectGroupId: group.id,
      createdByUserId: dbUser.id,
      title: dto.title,
      priority,
      message: dto.message,
      attachmentType: hasLink
        ? ProjectGroupAnnouncementAttachmentType.LINK
        : ProjectGroupAnnouncementAttachmentType.NONE,
      attachmentUrl: dto.attachmentUrl,
    });

    void this.emitAnnouncementRealtime({
      projectGroupId: group.id,
      actorUserId: dbUser.id,
      type: 'created',
      announcement,
    });

    return announcement;
  }

  async listAnnouncementsForMyGroup(user: any, query: ListProjectGroupAnnouncementsQueryDto) {
    const { group } = await this.requireApprovedMyGroupForStudent(user);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const { items, total } = await this.projectGroupRepository.listAnnouncementsPaged({
      projectGroupId: group.id,
      skip,
      take: limit,
    });

    return {
      items,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getAnnouncementForMyGroup(user: any, announcementId: string) {
    const { group } = await this.requireApprovedMyGroupForStudent(user);

    const announcement = await this.projectGroupRepository.findAnnouncementForGroup({
      id: announcementId,
      projectGroupId: group.id,
    });

    if (!announcement) {
      throw new BadRequestException('Announcement not found');
    }

    return announcement;
  }

  async updateAnnouncementForMyGroupLeader(
    user: any,
    announcementId: string,
    dto: UpdateProjectGroupAnnouncementDto,
    file?: Express.Multer.File
  ) {
    const { dbUser, group } = await this.requireApprovedMyGroupForLeader(user);

    const existing = await this.projectGroupRepository.findAnnouncementForGroup({
      id: announcementId,
      projectGroupId: group.id,
    });
    if (!existing) {
      throw new BadRequestException('Announcement not found');
    }

    const hasFile = !!file?.buffer;
    const hasLink = !!dto.attachmentUrl;
    const wantsRemove = dto.removeAttachment === true;

    const attachmentOpsCount = [hasFile, hasLink, wantsRemove].filter(Boolean).length;
    if (attachmentOpsCount > 1) {
      throw new BadRequestException(
        'Choose only one attachment operation: upload file, set attachmentUrl, or removeAttachment'
      );
    }

    const data: Prisma.ProjectGroupAnnouncementUpdateInput = {
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.message !== undefined ? { message: dto.message } : {}),
      ...(dto.priority !== undefined
        ? { priority: this.parseAnnouncementPriority(dto.priority as any) }
        : {}),
    };

    const deleteOldIfNeeded = async () => {
      if (existing.attachmentPublicId && existing.attachmentResourceType) {
        const resourceType =
          existing.attachmentResourceType === ProjectGroupAnnouncementAttachmentResourceType.image
            ? 'image'
            : 'raw';
        try {
          await this.cloudinary.deleteByPublicId(existing.attachmentPublicId, resourceType);
        } catch {
          // ignore cleanup failure
        }
      }
    };

    if (wantsRemove) {
      await deleteOldIfNeeded();
      Object.assign(data, {
        attachmentType: ProjectGroupAnnouncementAttachmentType.NONE,
        attachmentUrl: null,
        attachmentPublicId: null,
        attachmentResourceType: null,
        attachmentFileName: null,
        attachmentMimeType: null,
        attachmentSizeBytes: null,
      });

      const updated = await this.projectGroupRepository.updateAnnouncement({
        id: announcementId,
        data,
      });
      void this.emitAnnouncementRealtime({
        projectGroupId: group.id,
        actorUserId: dbUser.id,
        type: 'updated',
        announcement: updated,
      });
      return updated;
    }

    if (hasLink) {
      await deleteOldIfNeeded();
      Object.assign(data, {
        attachmentType: ProjectGroupAnnouncementAttachmentType.LINK,
        attachmentUrl: dto.attachmentUrl,
        attachmentPublicId: null,
        attachmentResourceType: null,
        attachmentFileName: null,
        attachmentMimeType: null,
        attachmentSizeBytes: null,
      });

      const updated = await this.projectGroupRepository.updateAnnouncement({
        id: announcementId,
        data,
      });
      void this.emitAnnouncementRealtime({
        projectGroupId: group.id,
        actorUserId: dbUser.id,
        type: 'updated',
        announcement: updated,
      });
      return updated;
    }

    if (hasFile) {
      const uploaded = await this.cloudinary.uploadProjectGroupAnnouncementAttachment({
        tenantId: group.tenantId,
        projectGroupId: group.id,
        userId: dbUser.id,
        buffer: file!.buffer,
        mimeType: file!.mimetype,
        fileName: file!.originalname,
      });

      try {
        await deleteOldIfNeeded();
        Object.assign(data, {
          attachmentType: ProjectGroupAnnouncementAttachmentType.FILE,
          attachmentUrl: uploaded.secureUrl,
          attachmentPublicId: uploaded.publicId,
          attachmentResourceType:
            uploaded.resourceType === 'image'
              ? ProjectGroupAnnouncementAttachmentResourceType.image
              : ProjectGroupAnnouncementAttachmentResourceType.raw,
          attachmentFileName: file!.originalname,
          attachmentMimeType: file!.mimetype,
          attachmentSizeBytes: typeof file!.size === 'number' ? file!.size : undefined,
        });

        const updated = await this.projectGroupRepository.updateAnnouncement({
          id: announcementId,
          data,
        });
        void this.emitAnnouncementRealtime({
          projectGroupId: group.id,
          actorUserId: dbUser.id,
          type: 'updated',
          announcement: updated,
        });
        return updated;
      } catch (err) {
        try {
          await this.cloudinary.deleteByPublicId(uploaded.publicId, uploaded.resourceType);
        } catch {
          // ignore cleanup failure
        }
        throw err;
      }
    }

    // No attachment changes; only text/priority updates.
    const updated = await this.projectGroupRepository.updateAnnouncement({
      id: announcementId,
      data,
    });
    void this.emitAnnouncementRealtime({
      projectGroupId: group.id,
      actorUserId: dbUser.id,
      type: 'updated',
      announcement: updated,
    });
    return updated;
  }

  async deleteAnnouncementForMyGroupLeader(user: any, announcementId: string) {
    const { dbUser, group } = await this.requireApprovedMyGroupForLeader(user);

    const existing = await this.projectGroupRepository.findAnnouncementForGroup({
      id: announcementId,
      projectGroupId: group.id,
    });
    if (!existing) {
      throw new BadRequestException('Announcement not found');
    }

    const deleted = await this.projectGroupRepository.deleteAnnouncement(announcementId);

    if (deleted.attachmentPublicId && deleted.attachmentResourceType) {
      const resourceType =
        deleted.attachmentResourceType === ProjectGroupAnnouncementAttachmentResourceType.image
          ? 'image'
          : 'raw';
      try {
        await this.cloudinary.deleteByPublicId(deleted.attachmentPublicId, resourceType);
      } catch {
        // ignore cleanup failure
      }
    }

    void this.emitAnnouncementRealtime({
      projectGroupId: group.id,
      actorUserId: dbUser.id,
      type: 'deleted',
      announcementId: deleted.id,
    });

    return { id: deleted.id, deleted: true };
  }

  async browseGroups(user: any, query: BrowseProjectGroupsQueryDto) {
    const dbUser = await this.requireStudentInDepartment(user);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const maxGroupSize = await this.getDepartmentMaxGroupSize(dbUser.departmentId);

    const { items, total } = await this.projectGroupRepository.browseGroupsPaged({
      tenantId: dbUser.tenantId,
      departmentId: dbUser.departmentId,
      skip,
      take: limit,
      search: query.search,
    });

    return {
      items: items.map((g) => {
        const memberCount = 1 + (g._count?.members ?? 0);
        const isFull = memberCount >= maxGroupSize;
        const isFormed = g.status === ProjectGroupStatus.APPROVED;
        const isJoinable = !isFull && !isFormed && g.status === ProjectGroupStatus.DRAFT;

        return {
          id: g.id,
          name: g.name,
          objectives: g.objectives,
          technologies: (g.technologies as string[] | null) ?? [],
          status: g.status,
          leader: g.leader,
          memberCount,
          maxGroupSize,
          isFull,
          isFormed,
          isJoinable,
          createdAt: g.createdAt,
          updatedAt: g.updatedAt,
        };
      }),
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getGroupDetailsForStudent(user: any, projectGroupId: string) {
    const dbUser = await this.requireStudentInDepartment(user);

    const group = await this.projectGroupRepository.findGroupDetailsForStudent({
      tenantId: dbUser.tenantId,
      departmentId: dbUser.departmentId,
      projectGroupId,
    });

    if (!group) {
      throw new BadRequestException('Group not found');
    }

    const maxGroupSize = await this.getDepartmentMaxGroupSize(group.departmentId);
    const memberCount = 1 + (group._count?.members ?? 0);
    const isFull = memberCount >= maxGroupSize;
    const isFormed = group.status === ProjectGroupStatus.APPROVED;
    const isJoinable = !isFull && !isFormed && group.status === ProjectGroupStatus.DRAFT;

    return {
      id: group.id,
      tenantId: group.tenantId,
      departmentId: group.departmentId,
      name: group.name,
      objectives: group.objectives,
      technologies: (group.technologies as string[] | null) ?? [],
      status: group.status,
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
      leader: group.leader,
      members: group.members.map((m) => ({
        id: m.user.id,
        firstName: m.user.firstName,
        lastName: m.user.lastName,
        email: m.user.email,
        avatarUrl: m.user.avatarUrl,
        joinedAt: m.joinedAt,
      })),
      memberCount,
      maxGroupSize,
      isFull,
      isFormed,
      isJoinable,
    };
  }

  async createJoinRequest(
    user: any,
    projectGroupId: string,
    dto: CreateProjectGroupJoinRequestDto
  ) {
    const dbUser = await this.requireStudentInDepartment(user);

    const alreadyMember = await this.projectGroupRepository.userIsMemberOfAnyGroup(dbUser.id);
    if (alreadyMember) {
      throw new BadRequestException('Student has already joined a group');
    }

    const leaderGroup = await this.projectGroupRepository.findByLeaderUserId(dbUser.id);
    if (leaderGroup) {
      throw new BadRequestException('Student is already a group leader');
    }

    const group = await this.projectGroupRepository.findGroupForJoinRequest({
      tenantId: dbUser.tenantId,
      departmentId: dbUser.departmentId,
      projectGroupId,
    });
    if (!group) {
      throw new BadRequestException('Group not found');
    }

    if (group.status !== ProjectGroupStatus.DRAFT) {
      throw new BadRequestException('Group is not accepting join requests');
    }

    const maxGroupSize = await this.getDepartmentMaxGroupSize(group.departmentId);
    const memberCount = await this.projectGroupRepository.countGroupMembers(group.id);
    const currentSize = 1 + memberCount;
    if (currentSize >= maxGroupSize) {
      throw new BadRequestException('Group is full');
    }

    const existingPending = await this.projectGroupRepository.findPendingJoinRequest({
      projectGroupId: group.id,
      requestedByUserId: dbUser.id,
    });
    if (existingPending) {
      return {
        request: {
          id: existingPending.id,
          status: existingPending.status,
          createdAt: existingPending.createdAt,
        },
        message: 'Join request already sent',
      };
    }

    const created = await this.projectGroupRepository.createJoinRequest({
      tenantId: dbUser.tenantId,
      departmentId: dbUser.departmentId,
      projectGroupId: group.id,
      leaderUserId: group.leaderUserId,
      requestedByUserId: dbUser.id,
      message: dto.message,
    });

    return {
      request: {
        id: created.id,
        status: created.status,
        createdAt: created.createdAt,
      },
    };
  }

  async listMyJoinRequests(user: any, query: ListJoinRequestsQueryDto) {
    const dbUser = await this.requireStudentInDepartment(user);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const status = this.parseJoinRequestStatus(query.status);

    const { items, total } = await this.projectGroupRepository.listJoinRequestsForStudentPaged({
      requestedByUserId: dbUser.id,
      tenantId: dbUser.tenantId,
      departmentId: dbUser.departmentId,
      skip,
      take: limit,
      status,
    });

    return {
      items: items.map((r) => ({
        id: r.id,
        status: r.status,
        message: r.message,
        createdAt: r.createdAt,
        decidedAt: r.decidedAt,
        rejectionReason: r.rejectionReason,
        group: {
          id: r.projectGroup.id,
          name: r.projectGroup.name,
          status: r.projectGroup.status,
          leader: r.projectGroup.leader,
        },
      })),
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async cancelMyJoinRequest(user: any, requestId: string) {
    const dbUser = await this.requireStudentInDepartment(user);

    const now = new Date();

    const existing = await this.prisma.projectGroupJoinRequest.findFirst({
      where: {
        id: requestId,
        requestedByUserId: dbUser.id,
        tenantId: dbUser.tenantId,
        departmentId: dbUser.departmentId,
      },
      select: { id: true, status: true, createdAt: true },
    });
    if (!existing) {
      throw new BadRequestException('Join request not found');
    }
    if (existing.status !== ProjectGroupJoinRequestStatus.PENDING) {
      throw new BadRequestException(`Join request is ${existing.status.toLowerCase()}`);
    }

    const cancelled = await this.projectGroupRepository.cancelJoinRequest({
      id: existing.id,
      requestedByUserId: dbUser.id,
      decidedAt: now,
    });

    return { request: cancelled };
  }

  async listJoinRequestsForMyGroupLeader(user: any, query: ListJoinRequestsQueryDto) {
    const dbUser = await this.requireApprovedGroupLeader(user);

    const group = await this.projectGroupRepository.findMyGroupForLeader(dbUser.id);
    if (!group) {
      throw new BadRequestException('Group not found for this group leader');
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const status = this.parseJoinRequestStatus(query.status);

    const { items, total } = await this.projectGroupRepository.listJoinRequestsForLeaderPaged({
      leaderUserId: dbUser.id,
      tenantId: dbUser.tenantId,
      departmentId: dbUser.departmentId,
      skip,
      take: limit,
      status,
    });

    return {
      items: items.map((r) => ({
        id: r.id,
        status: r.status,
        message: r.message,
        createdAt: r.createdAt,
        student: r.requestedBy,
        group: r.projectGroup,
      })),
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async approveJoinRequestForMyGroup(user: any, requestId: string) {
    const dbUser = await this.requireApprovedGroupLeader(user);
    const now = new Date();

    const result = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const req = await tx.projectGroupJoinRequest.findUnique({
        where: { id: requestId },
        select: {
          id: true,
          status: true,
          tenantId: true,
          departmentId: true,
          projectGroupId: true,
          leaderUserId: true,
          requestedByUserId: true,
          projectGroup: {
            select: {
              id: true,
              departmentId: true,
              status: true,
              leaderUserId: true,
            },
          },
        },
      });

      if (!req) {
        throw new BadRequestException('Join request not found');
      }

      if (req.tenantId !== dbUser.tenantId || req.departmentId !== dbUser.departmentId) {
        throw new BadRequestException('Join request not found');
      }

      if (req.leaderUserId !== dbUser.id || req.projectGroup.leaderUserId !== dbUser.id) {
        throw new BadRequestException('Join request not found');
      }

      if (req.status === ProjectGroupJoinRequestStatus.APPROVED) {
        return { approved: true, requestId: req.id, memberAdded: false };
      }

      if (req.status !== ProjectGroupJoinRequestStatus.PENDING) {
        throw new BadRequestException(`Join request is ${req.status.toLowerCase()}`);
      }

      if (req.projectGroup.status !== ProjectGroupStatus.DRAFT) {
        throw new BadRequestException('Group is not accepting join requests');
      }

      const alreadyMember = await tx.projectGroupMember.findFirst({
        where: { userId: req.requestedByUserId },
        select: { id: true },
      });
      if (alreadyMember) {
        await tx.projectGroupJoinRequest.update({
          where: { id: req.id },
          data: {
            status: ProjectGroupJoinRequestStatus.REVOKED,
            decidedAt: now,
            decidedByUserId: dbUser.id,
          },
        });
        throw new BadRequestException('Student has already joined a group');
      }

      const leaderGroup = await tx.projectGroup.findUnique({
        where: { leaderUserId: req.requestedByUserId },
        select: { id: true },
      });
      if (leaderGroup) {
        await tx.projectGroupJoinRequest.update({
          where: { id: req.id },
          data: {
            status: ProjectGroupJoinRequestStatus.REVOKED,
            decidedAt: now,
            decidedByUserId: dbUser.id,
          },
        });
        throw new BadRequestException('Student is already a group leader');
      }

      const maxGroupSizeSetting = await tx.departmentGroupSizeSetting.findUnique({
        where: { departmentId: req.projectGroup.departmentId },
        select: { maxGroupSize: true },
      });
      const maxGroupSize = maxGroupSizeSetting?.maxGroupSize ?? DEFAULT_MAX_GROUP_SIZE;

      const memberCount = await tx.projectGroupMember.count({
        where: { projectGroupId: req.projectGroupId },
      });
      const currentSize = 1 + memberCount;
      if (currentSize >= maxGroupSize) {
        throw new BadRequestException('Group is full');
      }

      await tx.projectGroupMember.create({
        data: {
          projectGroupId: req.projectGroupId,
          userId: req.requestedByUserId,
        },
      });

      await tx.projectGroupJoinRequest.update({
        where: { id: req.id },
        data: {
          status: ProjectGroupJoinRequestStatus.APPROVED,
          decidedAt: now,
          decidedByUserId: dbUser.id,
        },
      });

      await tx.projectGroupJoinRequest.updateMany({
        where: {
          requestedByUserId: req.requestedByUserId,
          status: ProjectGroupJoinRequestStatus.PENDING,
          id: { not: req.id },
        },
        data: {
          status: ProjectGroupJoinRequestStatus.REVOKED,
          decidedAt: now,
          decidedByUserId: dbUser.id,
        },
      });

      await tx.projectGroupInvitation.updateMany({
        where: {
          invitedUserId: req.requestedByUserId,
          status: ProjectGroupInvitationStatus.PENDING,
          expiresAt: { gt: now },
        },
        data: { status: ProjectGroupInvitationStatus.REVOKED, decidedAt: now },
      });

      return { approved: true, requestId: req.id, memberAdded: true };
    });

    return result;
  }

  async rejectJoinRequestForMyGroup(
    user: any,
    requestId: string,
    dto: DecideProjectGroupJoinRequestDto
  ) {
    const dbUser = await this.requireApprovedGroupLeader(user);
    const now = new Date();

    const req = await this.prisma.projectGroupJoinRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        status: true,
        tenantId: true,
        departmentId: true,
        leaderUserId: true,
      },
    });
    if (!req || req.tenantId !== dbUser.tenantId || req.departmentId !== dbUser.departmentId) {
      throw new BadRequestException('Join request not found');
    }
    if (req.leaderUserId !== dbUser.id) {
      throw new BadRequestException('Join request not found');
    }

    if (req.status === ProjectGroupJoinRequestStatus.REJECTED) {
      const existing = await this.prisma.projectGroupJoinRequest.findUnique({
        where: { id: req.id },
        select: { id: true, status: true, decidedAt: true, rejectionReason: true },
      });
      return { request: existing };
    }
    if (req.status !== ProjectGroupJoinRequestStatus.PENDING) {
      throw new BadRequestException(`Join request is ${req.status.toLowerCase()}`);
    }

    const updated = await this.prisma.projectGroupJoinRequest.update({
      where: { id: req.id },
      data: {
        status: ProjectGroupJoinRequestStatus.REJECTED,
        decidedAt: now,
        decidedByUserId: dbUser.id,
        rejectionReason: dto.reason,
      },
      select: { id: true, status: true, decidedAt: true, rejectionReason: true },
    });

    return { request: updated };
  }

  async submitMyGroupForReview(user: any) {
    const dbUser = await this.requireApprovedGroupLeader(user);
    const now = new Date();

    const group = await this.projectGroupRepository.findMyGroupForLeader(dbUser.id);
    if (!group) {
      throw new BadRequestException('Group not found for this group leader');
    }

    if (group.status === ProjectGroupStatus.SUBMITTED) {
      return {
        group: {
          id: group.id,
          status: group.status,
          submittedAt: group.submittedAt,
        },
      };
    }

    if (group.status !== ProjectGroupStatus.DRAFT) {
      throw new BadRequestException('Only draft groups can be submitted');
    }

    const { minGroupSize, maxGroupSize } = await this.getDepartmentGroupSizeSetting(
      group.departmentId
    );
    const memberCount = await this.projectGroupRepository.countGroupMembers(group.id);
    const currentSize = 1 + memberCount;
    if (currentSize < minGroupSize) {
      throw new BadRequestException(`Group size must be at least ${minGroupSize}`);
    }
    if (currentSize > maxGroupSize) {
      throw new BadRequestException(`Group size must be at most ${maxGroupSize}`);
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const revokedInvitations = await tx.projectGroupInvitation.updateMany({
        where: {
          projectGroupId: group.id,
          status: ProjectGroupInvitationStatus.PENDING,
          expiresAt: { gt: now },
        },
        data: {
          status: ProjectGroupInvitationStatus.REVOKED,
          decidedAt: now,
        },
      });

      const revokedJoinRequests = await tx.projectGroupJoinRequest.updateMany({
        where: {
          projectGroupId: group.id,
          status: ProjectGroupJoinRequestStatus.PENDING,
        },
        data: {
          status: ProjectGroupJoinRequestStatus.REVOKED,
          decidedAt: now,
          decidedByUserId: dbUser.id,
        },
      });

      const updated = await tx.projectGroup.update({
        where: { id: group.id },
        data: {
          status: ProjectGroupStatus.SUBMITTED,
          submittedAt: now,
          reviewedAt: null,
          reviewedByUserId: null,
          rejectionReason: null,
        },
        select: {
          id: true,
          status: true,
          submittedAt: true,
        },
      });

      return {
        group: updated,
        revokedInvitationsCount: revokedInvitations.count,
        revokedJoinRequestsCount: revokedJoinRequests.count,
      };
    });
  }

  async reopenMyRejectedGroup(user: any) {
    const dbUser = await this.requireApprovedGroupLeader(user);

    const group = await this.projectGroupRepository.findMyGroupForLeader(dbUser.id);
    if (!group) {
      throw new BadRequestException('Group not found for this group leader');
    }

    if (group.status !== ProjectGroupStatus.REJECTED) {
      throw new BadRequestException('Only rejected groups can be reopened');
    }

    const updated = await this.prisma.projectGroup.update({
      where: { id: group.id },
      data: {
        status: ProjectGroupStatus.DRAFT,
        submittedAt: null,
        reviewedAt: null,
        reviewedByUserId: null,
        rejectionReason: null,
      },
      select: {
        id: true,
        status: true,
        submittedAt: true,
      },
    });

    return { group: updated };
  }

  async listSubmittedGroupsForReview(user: any, query: ListSubmittedProjectGroupsQueryDto) {
    const reviewer = await this.requireDepartmentReviewer(user);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const { minGroupSize, maxGroupSize } = await this.getDepartmentGroupSizeSetting(
      reviewer.departmentId
    );

    const { items, total } = await this.projectGroupRepository.listSubmittedGroupsForReviewPaged({
      tenantId: reviewer.tenantId,
      departmentId: reviewer.departmentId,
      skip,
      take: limit,
      search: query.search,
    });

    return {
      items: items.map((g) => {
        const memberCount = 1 + (g._count?.members ?? 0);
        return {
          id: g.id,
          name: g.name,
          status: g.status,
          submittedAt: g.submittedAt,
          leader: g.leader,
          memberCount,
          minGroupSize,
          maxGroupSize,
          createdAt: g.createdAt,
        };
      }),
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async approveSubmittedGroup(user: any, groupId: string) {
    const reviewer = await this.requireDepartmentReviewer(user);
    const now = new Date();

    const group = await this.projectGroupRepository.findGroupForReview({
      tenantId: reviewer.tenantId,
      departmentId: reviewer.departmentId,
      groupId,
    });
    if (!group) {
      throw new BadRequestException('Group not found');
    }

    if (group.status !== ProjectGroupStatus.SUBMITTED) {
      throw new BadRequestException(`Group is ${group.status.toLowerCase()}`);
    }

    const { minGroupSize, maxGroupSize } = await this.getDepartmentGroupSizeSetting(
      reviewer.departmentId
    );

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const memberCount = await tx.projectGroupMember.count({
        where: { projectGroupId: group.id },
      });
      const currentSize = 1 + memberCount;
      if (currentSize < minGroupSize) {
        throw new BadRequestException(`Group size must be at least ${minGroupSize}`);
      }
      if (currentSize > maxGroupSize) {
        throw new BadRequestException(`Group size must be at most ${maxGroupSize}`);
      }

      await tx.projectGroupInvitation.updateMany({
        where: {
          projectGroupId: group.id,
          status: ProjectGroupInvitationStatus.PENDING,
          expiresAt: { gt: now },
        },
        data: {
          status: ProjectGroupInvitationStatus.REVOKED,
          decidedAt: now,
        },
      });

      await tx.projectGroupJoinRequest.updateMany({
        where: {
          projectGroupId: group.id,
          status: ProjectGroupJoinRequestStatus.PENDING,
        },
        data: {
          status: ProjectGroupJoinRequestStatus.REVOKED,
          decidedAt: now,
          decidedByUserId: reviewer.id,
        },
      });

      const updated = await tx.projectGroup.update({
        where: { id: group.id },
        data: {
          status: ProjectGroupStatus.APPROVED,
          reviewedAt: now,
          reviewedByUserId: reviewer.id,
          rejectionReason: null,
        },
        select: {
          id: true,
          status: true,
          submittedAt: true,
          reviewedAt: true,
          reviewedByUserId: true,
        },
      });

      return { group: updated };
    });
  }

  async rejectSubmittedGroup(user: any, groupId: string, dto: DecideProjectGroupReviewDto) {
    const reviewer = await this.requireDepartmentReviewer(user);
    const now = new Date();

    const group = await this.projectGroupRepository.findGroupForReview({
      tenantId: reviewer.tenantId,
      departmentId: reviewer.departmentId,
      groupId,
    });
    if (!group) {
      throw new BadRequestException('Group not found');
    }

    if (group.status !== ProjectGroupStatus.SUBMITTED) {
      throw new BadRequestException(`Group is ${group.status.toLowerCase()}`);
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.projectGroupInvitation.updateMany({
        where: {
          projectGroupId: group.id,
          status: ProjectGroupInvitationStatus.PENDING,
          expiresAt: { gt: now },
        },
        data: {
          status: ProjectGroupInvitationStatus.REVOKED,
          decidedAt: now,
        },
      });

      await tx.projectGroupJoinRequest.updateMany({
        where: {
          projectGroupId: group.id,
          status: ProjectGroupJoinRequestStatus.PENDING,
        },
        data: {
          status: ProjectGroupJoinRequestStatus.REVOKED,
          decidedAt: now,
          decidedByUserId: reviewer.id,
        },
      });

      const updated = await tx.projectGroup.update({
        where: { id: group.id },
        data: {
          status: ProjectGroupStatus.REJECTED,
          reviewedAt: now,
          reviewedByUserId: reviewer.id,
          rejectionReason: dto.reason,
        },
        select: {
          id: true,
          status: true,
          submittedAt: true,
          reviewedAt: true,
          reviewedByUserId: true,
          rejectionReason: true,
        },
      });

      return { group: updated };
    });
  }

  async createGroup(user: any, dto: CreateProjectGroupDto) {
    const dbUser = await this.requireApprovedGroupLeader(user);

    const existingGroup = await this.projectGroupRepository.findByLeaderUserId(dbUser.id);
    if (existingGroup) {
      throw new BadRequestException('Group leader has already created a group');
    }

    const created = await this.projectGroupRepository.create({
      tenantId: dbUser.tenantId,
      departmentId: dbUser.departmentId,
      leaderUserId: dbUser.id,
      name: dto.name,
      objectives: dto.objectives,
      technologies: dto.technologies,
    });

    return {
      ...created,
      technologies: (created.technologies as string[] | null) ?? [],
    };
  }

  async getMyGroup(user: any) {
    const dbUser = await this.requireStudentInDepartment(user);

    const now = new Date();
    const group = await this.projectGroupRepository.findMyGroupDetailsForStudent({
      tenantId: dbUser.tenantId,
      departmentId: dbUser.departmentId,
      userId: dbUser.id,
      now,
    });

    if (!group) {
      throw new BadRequestException('Group not found for this student');
    }

    return {
      ...group,
      technologies: (group.technologies as string[] | null) ?? [],
    };
  }

  async listAvailableStudents(user: any, query: ListAvailableStudentsQueryDto) {
    const dbUser = await this.requireApprovedGroupLeader(user);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const { items, total } = await this.projectGroupRepository.listAvailableStudentsPaged({
      tenantId: dbUser.tenantId,
      departmentId: dbUser.departmentId,
      excludeUserId: dbUser.id,
      skip,
      take: limit,
      search: query.search,
    });

    return {
      items: items.map((u) => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        avatarUrl: u.avatarUrl,
        status: u.status,
        emailVerified: u.emailVerified,
        tenantId: u.tenantId,
        departmentId: u.departmentId,
        createdAt: u.createdAt,
        profile: {
          bio: u.student?.bio ?? null,
          githubUrl: u.student?.githubUrl ?? null,
          linkedinUrl: u.student?.linkedinUrl ?? null,
          portfolioUrl: u.student?.portfolioUrl ?? null,
          techStack: (u.student?.techStack as string[] | null) ?? [],
          updatedAt: u.student?.updatedAt ?? null,
        },
      })),
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async previewInvitationEmail(user: any, dto: PreviewProjectGroupInvitationEmailDto) {
    const dbUser = await this.requireApprovedGroupLeader(user);

    if (dto.invitedUserId === dbUser.id) {
      throw new BadRequestException('You cannot invite yourself');
    }

    const group = await this.projectGroupRepository.findMyGroupForLeader(dbUser.id);
    if (!group) {
      throw new BadRequestException('Group not found for this group leader');
    }

    if (group.status !== ProjectGroupStatus.DRAFT) {
      throw new BadRequestException('Group is not accepting invitations');
    }

    const invitedUser = await this.prisma.user.findUnique({
      where: { id: dto.invitedUserId },
      select: {
        id: true,
        tenantId: true,
        departmentId: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        deletedAt: true,
        roles: {
          where: { revokedAt: null },
          select: { role: { select: { name: true } } },
        },
        projectGroupLed: { select: { id: true } },
        projectGroupMemberships: { select: { id: true } },
      },
    });

    if (!invitedUser || invitedUser.deletedAt) {
      throw new BadRequestException('Invited student not found');
    }

    if (
      invitedUser.tenantId !== dbUser.tenantId ||
      invitedUser.departmentId !== dbUser.departmentId
    ) {
      throw new BadRequestException('Invited student must be in the same department');
    }

    const invitedRoleNames = invitedUser.roles.map((r) => r.role.name);
    if (!invitedRoleNames.includes(ROLES.STUDENT)) {
      throw new BadRequestException('Invited user is not a student');
    }

    if (invitedUser.projectGroupLed) {
      throw new BadRequestException('Invited student is already a group leader');
    }

    if (invitedUser.projectGroupMemberships.length > 0) {
      throw new BadRequestException('Invited student has already joined a group');
    }

    const now = new Date();
    const maxGroupSize = await this.getDepartmentMaxGroupSize(group.departmentId);
    const memberCount = await this.projectGroupRepository.countGroupMembers(group.id);
    const pendingCount = await this.projectGroupRepository.countActivePendingInvites({
      projectGroupId: group.id,
      now,
    });
    const currentSize = 1 + memberCount;
    const reservedSize = currentSize + pendingCount;
    if (reservedSize >= maxGroupSize) {
      throw new BadRequestException('Group has reached the maximum size');
    }

    const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const acceptUrl = this.buildApiUrl(`project-groups/invitations/accept/ui?token=preview-token`);
    const rejectUrl = this.buildApiUrl(`project-groups/invitations/reject/ui?token=preview-token`);

    const inviteeName = `${invitedUser.firstName ?? ''} ${invitedUser.lastName ?? ''}`.trim();
    const leaderName = `${group.leader.firstName ?? ''} ${group.leader.lastName ?? ''}`.trim();
    const inviteeAvatarUrl = this.resolveAvatarUrl({
      avatarUrl: invitedUser.avatarUrl,
      fullName: inviteeName,
    });
    const leaderAvatarUrl = this.resolveAvatarUrl({
      avatarUrl: group.leader.avatarUrl,
      fullName: leaderName,
    });

    const built = buildProjectGroupInvitationEmailContent({
      commonTemplateParams: this.email.getCommonTemplateParams(),
      inviteeName: inviteeName || undefined,
      inviteeAvatarUrl,
      leaderName: leaderName || undefined,
      leaderAvatarUrl,
      groupName: group.name,
      acceptUrl,
      rejectUrl,
      expiresAt,
    });

    const templateId = this.config.get<number>('email.projectGroupInvitationTemplateId');

    return {
      subject: built.subject,
      htmlContent: built.htmlContent,
      textContent: built.textContent,
      templateParams: built.templateParams,
      acceptUrl,
      rejectUrl,
      expiresAt: expiresAt.toISOString(),
      templateId: templateId ?? null,
    };
  }

  async inviteStudentToMyGroup(user: any, dto: CreateProjectGroupInvitationDto) {
    const dbUser = await this.requireApprovedGroupLeader(user);

    if (dto.invitedUserId === dbUser.id) {
      throw new BadRequestException('You cannot invite yourself');
    }

    const group = await this.projectGroupRepository.findMyGroupForLeader(dbUser.id);
    if (!group) {
      throw new BadRequestException('Group not found for this group leader');
    }

    if (group.status !== ProjectGroupStatus.DRAFT) {
      throw new BadRequestException('Group is not accepting invitations');
    }

    const invitedUser = await this.prisma.user.findUnique({
      where: { id: dto.invitedUserId },
      select: {
        id: true,
        tenantId: true,
        departmentId: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        deletedAt: true,
        roles: {
          where: { revokedAt: null },
          select: { role: { select: { name: true } } },
        },
        projectGroupLed: { select: { id: true } },
        projectGroupMemberships: { select: { id: true } },
      },
    });

    if (!invitedUser || invitedUser.deletedAt) {
      throw new BadRequestException('Invited student not found');
    }

    if (
      invitedUser.tenantId !== dbUser.tenantId ||
      invitedUser.departmentId !== dbUser.departmentId
    ) {
      throw new BadRequestException('Invited student must be in the same department');
    }

    const invitedRoleNames = invitedUser.roles.map((r) => r.role.name);
    if (!invitedRoleNames.includes(ROLES.STUDENT)) {
      throw new BadRequestException('Invited user is not a student');
    }

    if (invitedUser.projectGroupLed) {
      throw new BadRequestException('Invited student is already a group leader');
    }

    if (invitedUser.projectGroupMemberships.length > 0) {
      throw new BadRequestException('Invited student has already joined a group');
    }

    const now = new Date();

    const existingPending = await this.projectGroupRepository.findActivePendingInviteForUser({
      projectGroupId: group.id,
      invitedUserId: invitedUser.id,
      now,
    });
    if (existingPending) {
      return {
        invitation: {
          id: existingPending.id,
          status: existingPending.status,
          expiresAt: existingPending.expiresAt,
        },
        message: 'Invitation already sent',
      };
    }

    const maxGroupSize = await this.getDepartmentMaxGroupSize(group.departmentId);
    const memberCount = await this.projectGroupRepository.countGroupMembers(group.id);
    const pendingCount = await this.projectGroupRepository.countActivePendingInvites({
      projectGroupId: group.id,
      now,
    });
    const currentSize = 1 + memberCount;
    const reservedSize = currentSize + pendingCount;
    if (reservedSize >= maxGroupSize) {
      throw new BadRequestException('Group has reached the maximum size');
    }

    const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const token = randomBytes(32).toString('hex');

    const invitation = await this.projectGroupRepository.createInvitation({
      tenantId: group.tenantId,
      departmentId: group.departmentId,
      projectGroupId: group.id,
      leaderUserId: group.leaderUserId,
      invitedUserId: invitedUser.id,
      invitedEmail: invitedUser.email.toLowerCase(),
      token,
      expiresAt,
    });

    // Best-effort email
    try {
      const templateId = this.config.get<number>('email.projectGroupInvitationTemplateId');
      if (!templateId) {
        this.logger.warn('ProjectGroupInvitationEmail: template ID not configured; skipping');
      } else {
        const acceptUrl = this.buildApiUrl(`project-groups/invitations/accept/ui?token=${token}`);
        const rejectUrl = this.buildApiUrl(`project-groups/invitations/reject/ui?token=${token}`);

        const workerEnabled = (process.env.WORKER ?? '').toLowerCase() === 'true';
        const isDev = (process.env.NODE_ENV ?? 'development').toLowerCase() !== 'production';

        const to = {
          email: invitedUser.email.toLowerCase(),
          name: `${invitedUser.firstName ?? ''} ${invitedUser.lastName ?? ''}`.trim() || undefined,
        };

        const params = {
          ...this.email.getCommonTemplateParams(),
          inviteeName:
            `${invitedUser.firstName ?? ''} ${invitedUser.lastName ?? ''}`.trim() || undefined,
          inviteeAvatarUrl: this.resolveAvatarUrl({
            avatarUrl: invitedUser.avatarUrl,
            fullName: `${invitedUser.firstName ?? ''} ${invitedUser.lastName ?? ''}`.trim(),
          }),
          leaderName:
            `${group.leader.firstName ?? ''} ${group.leader.lastName ?? ''}`.trim() || undefined,
          leaderAvatarUrl: this.resolveAvatarUrl({
            avatarUrl: group.leader.avatarUrl,
            fullName: `${group.leader.firstName ?? ''} ${group.leader.lastName ?? ''}`.trim(),
          }),
          groupName: group.name,
          acceptUrl,
          rejectUrl,
          expiresAt: expiresAt.toISOString(),
        };

        if (workerEnabled || !isDev) {
          await this.queueService.addTransactionalTemplateEmailJob({
            to,
            templateId,
            params,
          });
        } else {
          await this.email.sendTransactionalTemplateEmail({
            to,
            templateId,
            params,
          });
        }
      }
    } catch (err: any) {
      this.logger.warn(`ProjectGroupInvitationEmail: failed (${err?.message ?? 'unknown error'})`);
    }

    return {
      invitation: {
        id: invitation.id,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
      },
    };
  }

  async acceptInvitationByToken(params: { token: string }) {
    const token = (params.token ?? '').trim();
    if (!token) {
      throw new BadRequestException('token is required');
    }

    const now = new Date();

    const result = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const inv = await tx.projectGroupInvitation.findUnique({
        where: { token },
        select: {
          id: true,
          token: true,
          status: true,
          expiresAt: true,
          tenantId: true,
          departmentId: true,
          projectGroupId: true,
          invitedUserId: true,
          leaderUserId: true,
          projectGroup: {
            select: {
              id: true,
              name: true,
              departmentId: true,
              leaderUserId: true,
              status: true,
            },
          },
        },
      });

      if (!inv) {
        throw new BadRequestException('Invalid invitation token');
      }

      if (inv.projectGroup.status !== ProjectGroupStatus.DRAFT) {
        throw new BadRequestException('Group is not accepting invitations');
      }

      if (inv.status === ProjectGroupInvitationStatus.ACCEPTED) {
        return {
          accepted: true,
          groupId: inv.projectGroupId,
          groupName: inv.projectGroup.name,
        };
      }

      if (inv.status !== ProjectGroupInvitationStatus.PENDING) {
        throw new BadRequestException(`Invitation is ${inv.status.toLowerCase()}`);
      }

      if (inv.expiresAt <= now) {
        await tx.projectGroupInvitation.update({
          where: { id: inv.id },
          data: { status: ProjectGroupInvitationStatus.EXPIRED, decidedAt: now },
        });
        throw new BadRequestException('Invitation has expired');
      }

      const alreadyMember = await tx.projectGroupMember.findFirst({
        where: { userId: inv.invitedUserId },
        select: { id: true },
      });
      if (alreadyMember) {
        await tx.projectGroupInvitation.update({
          where: { id: inv.id },
          data: { status: ProjectGroupInvitationStatus.REVOKED, decidedAt: now },
        });
        throw new BadRequestException('Student has already joined a group');
      }

      const leaderGroup = await tx.projectGroup.findUnique({
        where: { leaderUserId: inv.invitedUserId },
        select: { id: true },
      });
      if (leaderGroup) {
        await tx.projectGroupInvitation.update({
          where: { id: inv.id },
          data: { status: ProjectGroupInvitationStatus.REVOKED, decidedAt: now },
        });
        throw new BadRequestException('Student is already a group leader');
      }

      const maxGroupSizeSetting = await tx.departmentGroupSizeSetting.findUnique({
        where: { departmentId: inv.projectGroup.departmentId },
        select: { maxGroupSize: true },
      });
      const maxGroupSize = maxGroupSizeSetting?.maxGroupSize ?? DEFAULT_MAX_GROUP_SIZE;

      const memberCount = await tx.projectGroupMember.count({
        where: { projectGroupId: inv.projectGroupId },
      });
      const currentSize = 1 + memberCount;
      if (currentSize >= maxGroupSize) {
        throw new BadRequestException('Group is full');
      }

      await tx.projectGroupMember.create({
        data: {
          projectGroupId: inv.projectGroupId,
          userId: inv.invitedUserId,
        },
      });

      await tx.projectGroupInvitation.update({
        where: { id: inv.id },
        data: { status: ProjectGroupInvitationStatus.ACCEPTED, decidedAt: now },
      });

      await tx.projectGroupInvitation.updateMany({
        where: {
          invitedUserId: inv.invitedUserId,
          status: ProjectGroupInvitationStatus.PENDING,
          expiresAt: { gt: now },
          id: { not: inv.id },
        },
        data: { status: ProjectGroupInvitationStatus.REVOKED, decidedAt: now },
      });

      return {
        accepted: true,
        groupId: inv.projectGroupId,
        groupName: inv.projectGroup.name,
      };
    });

    return result;
  }

  async rejectInvitationByToken(params: { token: string }) {
    const token = (params.token ?? '').trim();
    if (!token) {
      throw new BadRequestException('token is required');
    }

    const now = new Date();

    const result = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const inv = await tx.projectGroupInvitation.findUnique({
        where: { token },
        select: {
          id: true,
          status: true,
          expiresAt: true,
          projectGroupId: true,
          projectGroup: { select: { id: true, name: true, status: true } },
        },
      });

      if (!inv) {
        throw new BadRequestException('Invalid invitation token');
      }

      if (inv.projectGroup.status !== ProjectGroupStatus.DRAFT) {
        throw new BadRequestException('Group is not accepting invitations');
      }

      if (inv.status === ProjectGroupInvitationStatus.REJECTED) {
        return {
          rejected: true,
          groupId: inv.projectGroupId,
          groupName: inv.projectGroup.name,
        };
      }

      if (inv.status !== ProjectGroupInvitationStatus.PENDING) {
        throw new BadRequestException(`Invitation is ${inv.status.toLowerCase()}`);
      }

      if (inv.expiresAt <= now) {
        await tx.projectGroupInvitation.update({
          where: { id: inv.id },
          data: { status: ProjectGroupInvitationStatus.EXPIRED, decidedAt: now },
        });
        throw new BadRequestException('Invitation has expired');
      }

      await tx.projectGroupInvitation.update({
        where: { id: inv.id },
        data: { status: ProjectGroupInvitationStatus.REJECTED, decidedAt: now },
      });

      return {
        rejected: true,
        groupId: inv.projectGroupId,
        groupName: inv.projectGroup.name,
      };
    });

    return result;
  }
}
