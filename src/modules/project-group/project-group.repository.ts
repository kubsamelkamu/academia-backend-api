import { Injectable } from '@nestjs/common';
import {
  Prisma,
  ProjectGroupAnnouncementAttachmentResourceType,
  ProjectGroupAnnouncementAttachmentType,
  ProjectGroupAnnouncementPriority,
  ProjectGroupInvitationStatus,
  ProjectGroupJoinRequestStatus,
  ProjectGroupStatus,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { ROLES } from '../../common/constants/roles.constants';

@Injectable()
export class ProjectGroupRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listProjectGroupUserIds(projectGroupId: string) {
    const group = await this.prisma.projectGroup.findUnique({
      where: { id: projectGroupId },
      select: {
        leaderUserId: true,
        members: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!group) return [];

    return Array.from(
      new Set([group.leaderUserId, ...(group.members ?? []).map((m) => m.userId).filter(Boolean)])
    );
  }

  async findMyGroupBasicForStudent(params: {
    tenantId: string;
    departmentId: string;
    userId: string;
  }) {
    return this.prisma.projectGroup.findFirst({
      where: {
        tenantId: params.tenantId,
        departmentId: params.departmentId,
        OR: [{ leaderUserId: params.userId }, { members: { some: { userId: params.userId } } }],
      },
      select: {
        id: true,
        tenantId: true,
        departmentId: true,
        leaderUserId: true,
        status: true,
      },
    });
  }

  async listSubmittedGroupsForReviewPaged(params: {
    tenantId: string;
    departmentId: string;
    skip: number;
    take: number;
    search?: string;
  }) {
    const search = params.search?.trim();

    const where: Prisma.ProjectGroupWhereInput = {
      tenantId: params.tenantId,
      departmentId: params.departmentId,
      status: ProjectGroupStatus.SUBMITTED,
      ...(search
        ? {
            name: { contains: search, mode: 'insensitive' },
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.projectGroup.findMany({
        where,
        orderBy: [{ submittedAt: 'desc' }, { createdAt: 'desc' }],
        skip: params.skip,
        take: params.take,
        select: {
          id: true,
          name: true,
          status: true,
          submittedAt: true,
          createdAt: true,
          leader: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatarUrl: true,
            },
          },
          _count: {
            select: {
              members: true,
            },
          },
        },
      }),
      this.prisma.projectGroup.count({ where }),
    ]);

    return { items, total };
  }

  async findGroupForReview(params: { tenantId: string; departmentId: string; groupId: string }) {
    return this.prisma.projectGroup.findFirst({
      where: {
        id: params.groupId,
        tenantId: params.tenantId,
        departmentId: params.departmentId,
      },
      select: {
        id: true,
        tenantId: true,
        departmentId: true,
        leaderUserId: true,
        name: true,
        status: true,
        submittedAt: true,
        reviewedAt: true,
        reviewedByUserId: true,
        rejectionReason: true,
      },
    });
  }

  async browseGroupsPaged(params: {
    tenantId: string;
    departmentId: string;
    skip: number;
    take: number;
    search?: string;
  }) {
    const search = params.search?.trim();

    const where: Prisma.ProjectGroupWhereInput = {
      tenantId: params.tenantId,
      departmentId: params.departmentId,
      ...(search
        ? {
            name: { contains: search, mode: 'insensitive' },
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.projectGroup.findMany({
        where,
        orderBy: [{ name: 'asc' }, { createdAt: 'desc' }],
        skip: params.skip,
        take: params.take,
        select: {
          id: true,
          name: true,
          objectives: true,
          technologies: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          leader: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
          _count: {
            select: {
              members: true,
            },
          },
        },
      }),
      this.prisma.projectGroup.count({ where }),
    ]);

    return { items, total };
  }

  async findGroupDetailsForStudent(params: {
    tenantId: string;
    departmentId: string;
    projectGroupId: string;
  }) {
    return this.prisma.projectGroup.findFirst({
      where: {
        id: params.projectGroupId,
        tenantId: params.tenantId,
        departmentId: params.departmentId,
      },
      select: {
        id: true,
        tenantId: true,
        departmentId: true,
        leaderUserId: true,
        name: true,
        objectives: true,
        technologies: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        leader: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
        members: {
          orderBy: { joinedAt: 'asc' },
          select: {
            id: true,
            joinedAt: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },
        _count: {
          select: {
            members: true,
          },
        },
      },
    });
  }

  async findGroupForJoinRequest(params: {
    tenantId: string;
    departmentId: string;
    projectGroupId: string;
  }) {
    return this.prisma.projectGroup.findFirst({
      where: {
        id: params.projectGroupId,
        tenantId: params.tenantId,
        departmentId: params.departmentId,
      },
      select: {
        id: true,
        tenantId: true,
        departmentId: true,
        leaderUserId: true,
        status: true,
      },
    });
  }

  async findPendingJoinRequest(params: { projectGroupId: string; requestedByUserId: string }) {
    return this.prisma.projectGroupJoinRequest.findFirst({
      where: {
        projectGroupId: params.projectGroupId,
        requestedByUserId: params.requestedByUserId,
        status: ProjectGroupJoinRequestStatus.PENDING,
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async createJoinRequest(params: {
    tenantId: string;
    departmentId: string;
    projectGroupId: string;
    leaderUserId: string;
    requestedByUserId: string;
    message?: string;
  }) {
    return this.prisma.projectGroupJoinRequest.upsert({
      where: {
        projectGroupId_requestedByUserId: {
          projectGroupId: params.projectGroupId,
          requestedByUserId: params.requestedByUserId,
        },
      },
      create: {
        tenantId: params.tenantId,
        departmentId: params.departmentId,
        projectGroupId: params.projectGroupId,
        leaderUserId: params.leaderUserId,
        requestedByUserId: params.requestedByUserId,
        message: params.message,
      },
      update: {
        leaderUserId: params.leaderUserId,
        message: params.message,
        status: ProjectGroupJoinRequestStatus.PENDING,
        decidedAt: null,
        decidedByUserId: null,
        rejectionReason: null,
      },
      select: {
        id: true,
        status: true,
        message: true,
        createdAt: true,
      },
    });
  }

  async listJoinRequestsForStudentPaged(params: {
    requestedByUserId: string;
    tenantId: string;
    departmentId: string;
    skip: number;
    take: number;
    status?: ProjectGroupJoinRequestStatus;
  }) {
    const where: Prisma.ProjectGroupJoinRequestWhereInput = {
      requestedByUserId: params.requestedByUserId,
      tenantId: params.tenantId,
      departmentId: params.departmentId,
      ...(params.status ? { status: params.status } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.projectGroupJoinRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.take,
        select: {
          id: true,
          status: true,
          message: true,
          createdAt: true,
          decidedAt: true,
          rejectionReason: true,
          projectGroup: {
            select: {
              id: true,
              name: true,
              status: true,
              leader: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.projectGroupJoinRequest.count({ where }),
    ]);

    return { items, total };
  }

  async listJoinRequestsForLeaderPaged(params: {
    leaderUserId: string;
    tenantId: string;
    departmentId: string;
    skip: number;
    take: number;
    status?: ProjectGroupJoinRequestStatus;
  }) {
    const where: Prisma.ProjectGroupJoinRequestWhereInput = {
      leaderUserId: params.leaderUserId,
      tenantId: params.tenantId,
      departmentId: params.departmentId,
      ...(params.status ? { status: params.status } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.projectGroupJoinRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.take,
        select: {
          id: true,
          status: true,
          message: true,
          createdAt: true,
          requestedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatarUrl: true,
            },
          },
          projectGroup: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.projectGroupJoinRequest.count({ where }),
    ]);

    return { items, total };
  }

  async cancelJoinRequest(params: { id: string; requestedByUserId: string; decidedAt: Date }) {
    return this.prisma.projectGroupJoinRequest.update({
      where: { id: params.id },
      data: {
        status: ProjectGroupJoinRequestStatus.CANCELLED,
        decidedAt: params.decidedAt,
        decidedByUserId: params.requestedByUserId,
      },
      select: { id: true, status: true, decidedAt: true },
    });
  }

  async findByLeaderUserId(leaderUserId: string) {
    return this.prisma.projectGroup.findUnique({
      where: { leaderUserId },
      select: {
        id: true,
        tenantId: true,
        departmentId: true,
        leaderUserId: true,
        name: true,
        objectives: true,
        technologies: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async create(params: {
    tenantId: string;
    departmentId: string;
    leaderUserId: string;
    name: string;
    objectives: string;
    technologies: string[];
  }) {
    return this.prisma.projectGroup.create({
      data: {
        tenantId: params.tenantId,
        departmentId: params.departmentId,
        leaderUserId: params.leaderUserId,
        name: params.name,
        objectives: params.objectives,
        technologies: params.technologies,
      },
      select: {
        id: true,
        tenantId: true,
        departmentId: true,
        leaderUserId: true,
        name: true,
        objectives: true,
        technologies: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findByIdForInvite(groupId: string) {
    return this.prisma.projectGroup.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        tenantId: true,
        departmentId: true,
        leaderUserId: true,
        name: true,
        createdAt: true,
      },
    });
  }

  async findMyGroupForLeader(leaderUserId: string) {
    return this.prisma.projectGroup.findUnique({
      where: { leaderUserId },
      select: {
        id: true,
        tenantId: true,
        departmentId: true,
        leaderUserId: true,
        name: true,
        status: true,
        submittedAt: true,
        reviewedAt: true,
        reviewedByUserId: true,
        rejectionReason: true,
        leader: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  async findMyGroupDetailsForLeader(params: { leaderUserId: string; now: Date }) {
    const group = await this.prisma.projectGroup.findUnique({
      where: { leaderUserId: params.leaderUserId },
      select: {
        id: true,
        tenantId: true,
        departmentId: true,
        leaderUserId: true,
        name: true,
        objectives: true,
        technologies: true,
        status: true,
        submittedAt: true,
        reviewedAt: true,
        reviewedByUserId: true,
        rejectionReason: true,
        createdAt: true,
        updatedAt: true,
        leader: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
        reviewedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
        members: {
          orderBy: { joinedAt: 'asc' },
          select: {
            id: true,
            joinedAt: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    if (!group) return null;

    const pendingInvitationsCount = await this.prisma.projectGroupInvitation.count({
      where: {
        projectGroupId: group.id,
        status: ProjectGroupInvitationStatus.PENDING,
        expiresAt: { gt: params.now },
      },
    });

    return {
      ...group,
      pendingInvitationsCount,
    };
  }

  async findMyGroupDetailsForStudent(params: {
    tenantId: string;
    departmentId: string;
    userId: string;
    now: Date;
  }) {
    const group = await this.prisma.projectGroup.findFirst({
      where: {
        tenantId: params.tenantId,
        departmentId: params.departmentId,
        OR: [{ leaderUserId: params.userId }, { members: { some: { userId: params.userId } } }],
      },
      select: {
        id: true,
        tenantId: true,
        departmentId: true,
        leaderUserId: true,
        name: true,
        objectives: true,
        technologies: true,
        status: true,
        submittedAt: true,
        reviewedAt: true,
        reviewedByUserId: true,
        rejectionReason: true,
        createdAt: true,
        updatedAt: true,
        leader: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
        reviewedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
        members: {
          orderBy: { joinedAt: 'asc' },
          select: {
            id: true,
            joinedAt: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    if (!group) return null;

    const pendingInvitationsCount = await this.prisma.projectGroupInvitation.count({
      where: {
        projectGroupId: group.id,
        status: ProjectGroupInvitationStatus.PENDING,
        expiresAt: { gt: params.now },
      },
    });

    return {
      ...group,
      pendingInvitationsCount,
    };
  }

  async countGroupMembers(projectGroupId: string) {
    return this.prisma.projectGroupMember.count({
      where: { projectGroupId },
    });
  }

  async countActivePendingInvites(params: { projectGroupId: string; now: Date }) {
    return this.prisma.projectGroupInvitation.count({
      where: {
        projectGroupId: params.projectGroupId,
        status: ProjectGroupInvitationStatus.PENDING,
        expiresAt: { gt: params.now },
      },
    });
  }

  async findActivePendingInviteForUser(params: {
    projectGroupId: string;
    invitedUserId: string;
    now: Date;
  }) {
    return this.prisma.projectGroupInvitation.findFirst({
      where: {
        projectGroupId: params.projectGroupId,
        invitedUserId: params.invitedUserId,
        status: ProjectGroupInvitationStatus.PENDING,
        expiresAt: { gt: params.now },
      },
      select: {
        id: true,
        token: true,
        expiresAt: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async createInvitation(params: {
    tenantId: string;
    departmentId: string;
    projectGroupId: string;
    leaderUserId: string;
    invitedUserId: string;
    invitedEmail: string;
    token: string;
    expiresAt: Date;
  }) {
    return this.prisma.projectGroupInvitation.create({
      data: {
        tenantId: params.tenantId,
        departmentId: params.departmentId,
        projectGroupId: params.projectGroupId,
        leaderUserId: params.leaderUserId,
        invitedUserId: params.invitedUserId,
        invitedEmail: params.invitedEmail,
        token: params.token,
        expiresAt: params.expiresAt,
      },
      select: {
        id: true,
        projectGroupId: true,
        invitedUserId: true,
        invitedEmail: true,
        status: true,
        token: true,
        expiresAt: true,
        createdAt: true,
      },
    });
  }

  async findInvitationByToken(token: string) {
    return this.prisma.projectGroupInvitation.findUnique({
      where: { token },
      select: {
        id: true,
        token: true,
        status: true,
        expiresAt: true,
        decidedAt: true,
        tenantId: true,
        departmentId: true,
        projectGroupId: true,
        leaderUserId: true,
        invitedUserId: true,
        invitedEmail: true,
        projectGroup: {
          select: {
            id: true,
            name: true,
            departmentId: true,
            tenantId: true,
            leaderUserId: true,
            status: true,
          },
        },
      },
    });
  }

  async markInvitationExpired(invitationId: string, decidedAt: Date) {
    return this.prisma.projectGroupInvitation.update({
      where: { id: invitationId },
      data: {
        status: ProjectGroupInvitationStatus.EXPIRED,
        decidedAt,
      },
      select: { id: true, status: true },
    });
  }

  async updateInvitationStatus(params: {
    invitationId: string;
    status: ProjectGroupInvitationStatus;
    decidedAt: Date;
  }) {
    return this.prisma.projectGroupInvitation.update({
      where: { id: params.invitationId },
      data: {
        status: params.status,
        decidedAt: params.decidedAt,
      },
      select: { id: true, status: true, decidedAt: true },
    });
  }

  async revokeOtherPendingInvites(params: {
    invitedUserId: string;
    exceptInvitationId: string;
    now: Date;
  }) {
    return this.prisma.projectGroupInvitation.updateMany({
      where: {
        invitedUserId: params.invitedUserId,
        status: ProjectGroupInvitationStatus.PENDING,
        expiresAt: { gt: params.now },
        id: { not: params.exceptInvitationId },
      },
      data: {
        status: ProjectGroupInvitationStatus.REVOKED,
        decidedAt: params.now,
      },
    });
  }

  async userIsMemberOfAnyGroup(userId: string) {
    const match = await this.prisma.projectGroupMember.findFirst({
      where: { userId },
      select: { id: true, projectGroupId: true },
    });
    return match;
  }

  async addMember(projectGroupId: string, userId: string) {
    return this.prisma.projectGroupMember.create({
      data: {
        projectGroupId,
        userId,
      },
      select: {
        id: true,
        projectGroupId: true,
        userId: true,
        joinedAt: true,
      },
    });
  }

  async listAvailableStudentsPaged(params: {
    tenantId: string;
    departmentId: string;
    excludeUserId: string;
    skip: number;
    take: number;
    search?: string;
  }) {
    const search = params.search?.trim();

    const where: Prisma.UserWhereInput = {
      tenantId: params.tenantId,
      departmentId: params.departmentId,
      deletedAt: null,
      id: { not: params.excludeUserId },
      roles: {
        some: {
          revokedAt: null,
          role: { name: ROLES.STUDENT },
        },
      },
      // Not a leader of a group
      projectGroupLed: { is: null },
      // Not a member of any group
      projectGroupMemberships: { none: {} },
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip: params.skip,
        take: params.take,
        select: {
          id: true,
          tenantId: true,
          departmentId: true,
          firstName: true,
          lastName: true,
          email: true,
          avatarUrl: true,
          status: true,
          emailVerified: true,
          createdAt: true,
          student: {
            select: {
              bio: true,
              githubUrl: true,
              linkedinUrl: true,
              portfolioUrl: true,
              techStack: true,
              updatedAt: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, total };
  }

  async createAnnouncement(params: {
    tenantId: string;
    departmentId: string;
    projectGroupId: string;
    createdByUserId: string;
    title: string;
    priority: ProjectGroupAnnouncementPriority;
    message: string;
    attachmentType: ProjectGroupAnnouncementAttachmentType;
    attachmentUrl?: string;
    attachmentPublicId?: string;
    attachmentResourceType?: ProjectGroupAnnouncementAttachmentResourceType;
    attachmentFileName?: string;
    attachmentMimeType?: string;
    attachmentSizeBytes?: number;
  }) {
    return this.prisma.projectGroupAnnouncement.create({
      data: {
        tenantId: params.tenantId,
        departmentId: params.departmentId,
        projectGroupId: params.projectGroupId,
        createdByUserId: params.createdByUserId,
        title: params.title,
        priority: params.priority,
        message: params.message,
        attachmentType: params.attachmentType,
        attachmentUrl: params.attachmentUrl,
        attachmentPublicId: params.attachmentPublicId,
        attachmentResourceType: params.attachmentResourceType,
        attachmentFileName: params.attachmentFileName,
        attachmentMimeType: params.attachmentMimeType,
        attachmentSizeBytes: params.attachmentSizeBytes,
      },
      select: {
        id: true,
        projectGroupId: true,
        title: true,
        priority: true,
        message: true,
        attachmentType: true,
        attachmentUrl: true,
        attachmentFileName: true,
        attachmentMimeType: true,
        attachmentSizeBytes: true,
        createdAt: true,
        updatedAt: true,
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  async listAnnouncementsPaged(params: { projectGroupId: string; skip: number; take: number }) {
    const where: Prisma.ProjectGroupAnnouncementWhereInput = {
      projectGroupId: params.projectGroupId,
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.projectGroupAnnouncement.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip: params.skip,
        take: params.take,
        select: {
          id: true,
          projectGroupId: true,
          title: true,
          priority: true,
          message: true,
          attachmentType: true,
          attachmentUrl: true,
          attachmentFileName: true,
          attachmentMimeType: true,
          attachmentSizeBytes: true,
          createdAt: true,
          updatedAt: true,
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
        },
      }),
      this.prisma.projectGroupAnnouncement.count({ where }),
    ]);

    return { items, total };
  }

  async findAnnouncementForGroup(params: { id: string; projectGroupId: string }) {
    return this.prisma.projectGroupAnnouncement.findFirst({
      where: {
        id: params.id,
        projectGroupId: params.projectGroupId,
      },
      select: {
        id: true,
        tenantId: true,
        departmentId: true,
        projectGroupId: true,
        createdByUserId: true,
        title: true,
        priority: true,
        message: true,
        attachmentType: true,
        attachmentUrl: true,
        attachmentPublicId: true,
        attachmentResourceType: true,
        attachmentFileName: true,
        attachmentMimeType: true,
        attachmentSizeBytes: true,
        createdAt: true,
        updatedAt: true,
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  async updateAnnouncement(params: {
    id: string;
    data: Prisma.ProjectGroupAnnouncementUpdateInput;
  }) {
    return this.prisma.projectGroupAnnouncement.update({
      where: { id: params.id },
      data: params.data,
      select: {
        id: true,
        projectGroupId: true,
        title: true,
        priority: true,
        message: true,
        attachmentType: true,
        attachmentUrl: true,
        attachmentFileName: true,
        attachmentMimeType: true,
        attachmentSizeBytes: true,
        createdAt: true,
        updatedAt: true,
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
    });
  }

  async deleteAnnouncement(id: string) {
    return this.prisma.projectGroupAnnouncement.delete({
      where: { id },
      select: {
        id: true,
        attachmentPublicId: true,
        attachmentResourceType: true,
      },
    });
  }
}
