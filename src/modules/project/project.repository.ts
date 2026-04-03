import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MilestoneStatus, Prisma } from '@prisma/client';
import { ensureDepartmentDefaultMilestoneTemplate } from '../milestone/default-department-milestone-template';
import { ROLES } from '../../common/constants/roles.constants';

@Injectable()
export class ProjectRepository {
  constructor(private readonly prisma: PrismaService) {}

  private dedupeProjectsByGroupLatest<
    T extends {
      id: string;
      createdAt: Date;
      proposal?: { projectGroup?: { id?: string | null } | null } | null;
    },
  >(items: T[]): T[] {
    if (!Array.isArray(items) || items.length === 0) return [];

    const byKey = new Map<string, T>();

    for (const item of items) {
      const groupId = String(item.proposal?.projectGroup?.id ?? '').trim();
      const key = groupId || item.id;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, item);
        continue;
      }

      const existingTime = new Date(existing.createdAt).getTime();
      const itemTime = new Date(item.createdAt).getTime();
      if (itemTime > existingTime) {
        byKey.set(key, item);
      }
    }

    return Array.from(byKey.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  private addDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  async findProjectForMemberManagement(projectId: string) {
    return this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        tenantId: true,
        departmentId: true,
        status: true,
        members: {
          select: {
            userId: true,
            role: true,
          },
        },
      },
    });
  }

  async findProjectMembers(projectId: string) {
    return this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        tenantId: true,
        departmentId: true,
        status: true,
        members: {
          orderBy: { joinedAt: 'asc' },
          select: {
            userId: true,
            role: true,
            joinedAt: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatarUrl: true,
                status: true,
              },
            },
          },
        },
      },
    });
  }

  async findDepartmentGroupSizeSetting(departmentId: string) {
    return this.prisma.departmentGroupSizeSetting.findUnique({
      where: { departmentId },
      select: {
        minGroupSize: true,
        maxGroupSize: true,
      },
    });
  }

  async findUserForProjectMembership(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        tenantId: true,
        departmentId: true,
        status: true,
      },
    });
  }

  async userHasActiveRoleInTenant(params: { userId: string; tenantId: string; roleName: string }) {
    const { userId, tenantId, roleName } = params;
    const match = await this.prisma.userRole.findFirst({
      where: {
        userId,
        tenantId,
        revokedAt: null,
        role: { name: roleName },
      },
      select: { id: true },
    });
    return Boolean(match);
  }

  async upsertStudentMember(projectId: string, userId: string) {
    return this.prisma.projectMember.upsert({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
      update: {
        role: 'STUDENT',
      },
      create: {
        projectId,
        userId,
        role: 'STUDENT',
      },
      select: {
        id: true,
        projectId: true,
        userId: true,
        role: true,
        joinedAt: true,
      },
    });
  }

  async findProjectMember(projectId: string, userId: string) {
    return this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
      select: {
        id: true,
        projectId: true,
        userId: true,
        role: true,
      },
    });
  }

  async removeProjectMember(projectId: string, userId: string) {
    return this.prisma.projectMember.delete({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
      select: {
        id: true,
        projectId: true,
        userId: true,
        role: true,
      },
    });
  }

  async findProposalsByDepartment(
    departmentId: string,
    filters: {
      status?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ) {
    const where: Prisma.ProposalWhereInput = {
      departmentId,
      ...(filters.status && { status: filters.status as any }),
      ...(filters.startDate || filters.endDate
        ? {
            createdAt: {
              ...(filters.startDate && { gte: filters.startDate }),
              ...(filters.endDate && { lte: filters.endDate }),
            },
          }
        : {}),
    };

    return this.prisma.proposal.findMany({
      where,
      include: {
        submitter: { select: { id: true, firstName: true, lastName: true, email: true } },
        advisor: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
        projectGroup: {
          select: {
            id: true,
            name: true,
            leaderUserId: true,
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
              select: {
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
              orderBy: { joinedAt: 'asc' },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findProposalById(id: string) {
    return this.prisma.proposal.findUnique({
      where: { id },
      include: {
        submitter: { select: { id: true, firstName: true, lastName: true, email: true } },
        advisor: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
        projectGroup: {
          include: {
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
              include: {
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
              orderBy: { joinedAt: 'asc' },
            },
          },
        },
        department: { select: { id: true, name: true } },
        project: true,
      },
    });
  }

  async findProposalsBySubmitter(submittedBy: string) {
    return this.prisma.proposal.findMany({
      where: { submittedBy },
      include: {
        submitter: { select: { id: true, firstName: true, lastName: true, email: true } },
        advisor: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
        department: { select: { id: true, name: true } },
        project: true,
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findProposalsByProjectGroupId(params: { tenantId: string; projectGroupId: string }) {
    return this.prisma.proposal.findMany({
      where: {
        tenantId: params.tenantId,
        projectGroupId: params.projectGroupId,
      },
      include: {
        submitter: { select: { id: true, firstName: true, lastName: true, email: true } },
        advisor: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
        department: { select: { id: true, name: true } },
        project: true,
        projectGroup: {
          select: {
            id: true,
            name: true,
            leaderUserId: true,
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
              select: {
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
              orderBy: { joinedAt: 'asc' },
            },
          },
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createProposal(data: {
    tenantId: string;
    departmentId: string;
    projectGroupId?: string;
    title: string;
    proposedTitles: string[];
    description?: string;
    submittedBy: string;
    documents?: unknown[];
  }) {
    const createData: any = {
      tenantId: data.tenantId,
      departmentId: data.departmentId,
      projectGroupId: data.projectGroupId,
      title: data.title,
      proposedTitles: data.proposedTitles,
      description: data.description,
      submittedBy: data.submittedBy,
      documents: data.documents,
    };

    return this.prisma.proposal.create({
      data: createData,
      include: {
        submitter: { select: { id: true, firstName: true, lastName: true, email: true } },
        advisor: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
      },
    });
  }

  async findSubmittedProposalByProjectGroup(params: {
    tenantId: string;
    projectGroupId: string;
  }) {
    return this.prisma.proposal.findFirst({
      where: {
        tenantId: params.tenantId,
        projectGroupId: params.projectGroupId,
        status: 'SUBMITTED',
      },
      select: { id: true, status: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findActiveProposalRejectionReminder(params: { proposalId: string; now: Date }) {
    return this.prisma.projectGroupAnnouncement.findFirst({
      where: {
        proposalId: params.proposalId,
        kind: 'PROPOSAL_REJECTION_REMINDER' as any,
        expiredAt: null,
        OR: [{ deadlineAt: null }, { deadlineAt: { gt: params.now } }],
      },
      select: {
        id: true,
        proposalId: true,
        deadlineAt: true,
        expiredAt: true,
      },
    });
  }

  async createProposalRejectionReminder(params: {
    tenantId: string;
    departmentId: string;
    projectGroupId: string;
    proposalId: string;
    createdByUserId: string;
    title: string;
    message: string;
    deadlineAt: Date;
    disableAfterDeadline: boolean;
  }) {
    return this.prisma.projectGroupAnnouncement.create({
      data: {
        tenantId: params.tenantId,
        departmentId: params.departmentId,
        projectGroupId: params.projectGroupId,
        proposalId: params.proposalId,
        createdByUserId: params.createdByUserId,
        title: params.title,
        kind: 'PROPOSAL_REJECTION_REMINDER' as any,
        priority: 'HIGH',
        message: params.message,
        attachmentType: 'NONE',
        deadlineAt: params.deadlineAt,
        disableAfterDeadline: params.disableAfterDeadline,
      },
      select: {
        id: true,
        tenantId: true,
        departmentId: true,
        projectGroupId: true,
        proposalId: true,
        title: true,
        kind: true,
        priority: true,
        message: true,
        deadlineAt: true,
        disableAfterDeadline: true,
        expiredAt: true,
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

  async findGroupLeaderRequestStatus(studentUserId: string) {
    return this.prisma.groupLeaderRequest.findUnique({
      where: { studentUserId },
      select: { status: true },
    });
  }

  async findApprovedProjectGroupByLeader(params: {
    tenantId: string;
    departmentId: string;
    leaderUserId: string;
  }) {
    return this.prisma.projectGroup.findFirst({
      where: {
        tenantId: params.tenantId,
        departmentId: params.departmentId,
        leaderUserId: params.leaderUserId,
        status: 'APPROVED',
      },
      select: {
        id: true,
        status: true,
      },
    });
  }

  async updateProposalStatus(
    id: string,
    data: {
      status: string;
      feedback?: string | null;
      advisorId?: string;
      title?: string;
      selectedTitleIndex?: number;
    }
  ) {
    return this.prisma.proposal.update({
      where: { id },
      data: {
        status: data.status as any,
        ...(data.feedback !== undefined && { feedback: data.feedback }),
        ...(data.advisorId !== undefined && { advisorId: data.advisorId }),
        ...(data.title !== undefined && { title: data.title }),
        ...(data.selectedTitleIndex !== undefined && {
          selectedTitleIndex: data.selectedTitleIndex,
        }),
      },
      include: {
        submitter: { select: { id: true, firstName: true, lastName: true, email: true } },
        advisor: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
      },
    });
  }

  async updateProposalAdvisor(id: string, advisorId: string) {
    return this.prisma.proposal.update({
      where: { id },
      data: {
        advisorId,
      },
      include: {
        submitter: { select: { id: true, firstName: true, lastName: true, email: true } },
        advisor: {
          select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
        },
      },
    });
  }

  async updateProposalDocuments(id: string, documents: Prisma.InputJsonValue) {
    return this.prisma.proposal.update({
      where: { id },
      data: {
        documents,
      },
      include: {
        submitter: { select: { id: true, firstName: true, lastName: true, email: true } },
        advisor: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
      },
    });
  }

  async createProposalFeedback(data: {
    proposalId: string;
    authorId: string;
    authorRole: string;
    message: string;
  }) {
    return this.prisma.proposalFeedback.create({
      data: {
        proposalId: data.proposalId,
        authorId: data.authorId,
        authorRole: data.authorRole,
        message: data.message,
      },
      include: {
        author: {
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

  async listProposalFeedbacks(proposalId: string) {
    return this.prisma.proposalFeedback.findMany({
      where: { proposalId },
      orderBy: { createdAt: 'asc' },
      include: {
        author: {
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

  async deleteProposal(id: string) {
    return this.prisma.proposal.delete({ where: { id } });
  }

  // Project methods
  async findProjectsByDepartment(
    departmentId: string,
    filters: {
      status?: string;
      advisorId?: string;
      studentId?: string;
    }
  ) {
    const where: Prisma.ProjectWhereInput = {
      departmentId,
      ...(filters.status && { status: filters.status as any }),
      ...(filters.advisorId && { advisorId: filters.advisorId }),
      ...(filters.studentId && {
        members: {
          some: {
            userId: filters.studentId,
            role: 'STUDENT',
          },
        },
      }),
    };

    return this.prisma.project.findMany({
      where,
      include: {
        advisor: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
        members: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
        _count: { select: { milestones: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findProjectById(id: string) {
    return this.prisma.project.findUnique({
      where: { id },
      include: {
        proposal: { select: { id: true, title: true, description: true } },
        advisor: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
        members: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
        milestones: {
          orderBy: { dueDate: 'asc' },
        },
        department: { select: { id: true, name: true } },
      },
    });
  }

  async findProjectOverviewById(id: string) {
    return this.prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        tenantId: true,
        departmentId: true,
        title: true,
        description: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        department: {
          select: { id: true, name: true },
        },
        advisor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
            advisor: {
              select: {
                id: true,
                departmentId: true,
                loadLimit: true,
                currentLoad: true,
              },
            },
          },
        },
        proposal: {
          select: {
            id: true,
            projectGroup: {
              select: {
                id: true,
                name: true,
                technologies: true,
                leader: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    avatarUrl: true,
                    student: {
                      select: {
                        id: true,
                        bio: true,
                        githubUrl: true,
                        linkedinUrl: true,
                        portfolioUrl: true,
                        techStack: true,
                      },
                    },
                  },
                },
                members: {
                  select: {
                    user: {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        avatarUrl: true,
                        student: {
                          select: {
                            id: true,
                            bio: true,
                            githubUrl: true,
                            linkedinUrl: true,
                            portfolioUrl: true,
                            techStack: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        members: {
          select: {
            id: true,
            role: true,
            userId: true,
            joinedAt: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatarUrl: true,
                student: {
                  select: {
                    id: true,
                    bio: true,
                    githubUrl: true,
                    linkedinUrl: true,
                    portfolioUrl: true,
                    techStack: true,
                  },
                },
                advisor: {
                  select: {
                    id: true,
                    departmentId: true,
                    loadLimit: true,
                    currentLoad: true,
                  },
                },
              },
            },
          },
        },
        milestones: {
          orderBy: { dueDate: 'asc' },
          select: {
            id: true,
            title: true,
            description: true,
            dueDate: true,
            status: true,
            submittedAt: true,
            feedback: true,
            updatedAt: true,
            submissions: {
              where: { status: 'APPROVED' },
              orderBy: { approvedAt: 'desc' },
              take: 1,
              select: {
                id: true,
                status: true,
                fileName: true,
                mimeType: true,
                sizeBytes: true,
                fileUrl: true,
                filePublicId: true,
                resourceType: true,
                approvedAt: true,
                approvedBy: {
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
        },
      },
    });
  }

  async getOrCreateDepartmentDefaultMilestoneTemplateId(params: {
    tenantId: string;
    departmentId: string;
    createdById?: string;
  }): Promise<string> {
    const { tenantId, departmentId, createdById } = params;

    return this.prisma.$transaction(async (tx) => {
      return ensureDepartmentDefaultMilestoneTemplate({
        tx,
        tenantId,
        departmentId,
        createdById,
      });
    });
  }

  async createProjectFromProposal(
    proposalId: string,
    advisorId: string,
    milestoneTemplateId?: string
  ) {
    const proposal = await this.prisma.proposal.findUnique({
      where: { id: proposalId },
      include: {
        submitter: true,
        department: true,
        projectGroup: {
          select: {
            leaderUserId: true,
            members: {
              select: {
                userId: true,
              },
            },
          },
        },
      },
    });

    if (!proposal) throw new Error('Proposal not found');

    const template = milestoneTemplateId
      ? await this.prisma.milestoneTemplate.findFirst({
          where: {
            id: milestoneTemplateId,
            tenantId: proposal.tenantId,
            departmentId: proposal.departmentId,
            isActive: true,
          },
          include: {
            milestones: {
              orderBy: { sequence: 'asc' },
            },
          },
        })
      : null;

    if (milestoneTemplateId && !template) {
      throw new Error('Milestone template not found');
    }

    if (template && !template.milestones.length) {
      throw new Error('Milestone template has no milestones');
    }

    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          tenantId: proposal.tenantId,
          departmentId: proposal.departmentId,
          title: proposal.title,
          description: proposal.description,
          proposalId,
          advisorId,
          ...(milestoneTemplateId ? { milestoneTemplateId } : {}),
        },
      });

      const studentMemberIds = proposal.projectGroup
        ? Array.from(
            new Set([
              proposal.projectGroup.leaderUserId,
              ...proposal.projectGroup.members.map((member) => member.userId),
            ])
          )
        : [proposal.submittedBy];

      await tx.projectMember.createMany({
        data: studentMemberIds.map((userId) => ({
          projectId: project.id,
          userId,
          role: 'STUDENT',
        })),
        skipDuplicates: true,
      });

      // Add advisor as member if not already
      await tx.projectMember.upsert({
        where: {
          projectId_userId: {
            projectId: project.id,
            userId: advisorId,
          },
        },
        update: {},
        create: {
          projectId: project.id,
          userId: advisorId,
          role: 'ADVISOR',
        },
      });

      if (template) {
        let cumulativeDays = 0;
        const milestonesToCreate = template.milestones.map((m, index) => {
          cumulativeDays += m.defaultDurationDays;

          const isFirstMilestone = index === 0;

          return {
            projectId: project.id,
            title: m.title,
            description: m.description,
            dueDate: this.addDays(project.createdAt, cumulativeDays),
            status: isFirstMilestone ? MilestoneStatus.APPROVED : MilestoneStatus.PENDING,
            submittedAt: isFirstMilestone ? project.createdAt : null,
          };
        });

        await tx.milestone.createMany({
          data: milestonesToCreate,
        });
      }

      return project;
    });
  }

  async findMilestoneByIdWithProject(milestoneId: string) {
    return this.prisma.milestone.findUnique({
      where: { id: milestoneId },
      include: {
        project: {
          select: {
            id: true,
            tenantId: true,
            departmentId: true,
            milestoneTemplateId: true,
          },
        },
      },
    });
  }

  async updateProjectAdvisor(projectId: string, advisorId: string) {
    return this.prisma.$transaction(async (tx) => {
      // Fetch previous advisor for role downgrade during reassignment.
      const existing = await tx.project.findUnique({
        where: { id: projectId },
        select: { advisorId: true },
      });

      // Update project advisor
      const project = await tx.project.update({
        where: { id: projectId },
        data: { advisorId },
        include: {
          members: { select: { userId: true, role: true } },
        },
      });

      // Policy B: keep previously assigned advisor as a member,
      // but only one "assigned advisor" at a time.
      // Downgrade previous advisor membership role if it's different from the new advisor.
      const previousAdvisorId = existing?.advisorId ?? null;
      if (previousAdvisorId && previousAdvisorId !== advisorId) {
        await tx.projectMember.updateMany({
          where: {
            projectId,
            userId: previousAdvisorId,
            role: 'ADVISOR',
          },
          data: {
            role: 'STUDENT',
          },
        });
      }

      // Update or create advisor membership
      await tx.projectMember.upsert({
        where: {
          projectId_userId: {
            projectId,
            userId: advisorId,
          },
        },
        update: { role: 'ADVISOR' },
        create: {
          projectId,
          userId: advisorId,
          role: 'ADVISOR',
        },
      });

      return project;
    });
  }

  // Milestone methods
  async findMilestonesByProject(projectId: string) {
    return this.prisma.milestone.findMany({
      where: { projectId },
      orderBy: { dueDate: 'asc' },
    });
  }

  async updateMilestoneStatus(id: string, data: { status: string; feedback?: string }) {
    const updateData: any = { status: data.status };
    if (data.feedback !== undefined) updateData.feedback = data.feedback;
    if (data.status === 'SUBMITTED') updateData.submittedAt = new Date();

    return this.prisma.milestone.update({
      where: { id },
      data: updateData,
    });
  }

  async createMilestoneSubmission(params: {
    milestoneId: string;
    uploadedByUserId: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    fileUrl: string;
    filePublicId: string;
    resourceType: string;
  }) {
    return this.prisma.milestoneSubmission.create({
      data: {
        milestoneId: params.milestoneId,
        uploadedByUserId: params.uploadedByUserId,
        fileName: params.fileName,
        mimeType: params.mimeType,
        sizeBytes: params.sizeBytes,
        fileUrl: params.fileUrl,
        filePublicId: params.filePublicId,
        resourceType: params.resourceType,
        status: 'SUBMITTED',
      },
      select: {
        id: true,
        milestoneId: true,
        status: true,
        fileName: true,
        mimeType: true,
        sizeBytes: true,
        fileUrl: true,
        filePublicId: true,
        resourceType: true,
        uploadedByUserId: true,
        approvedByUserId: true,
        approvedAt: true,
        createdAt: true,
      },
    });
  }

  async listMilestoneSubmissions(milestoneId: string) {
    return this.prisma.milestoneSubmission.findMany({
      where: { milestoneId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        milestoneId: true,
        status: true,
        fileName: true,
        mimeType: true,
        sizeBytes: true,
        fileUrl: true,
        filePublicId: true,
        resourceType: true,
        uploadedBy: {
          select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
        },
        approvedBy: {
          select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
        },
        approvedAt: true,
        createdAt: true,
      },
    });
  }

  async approveMilestoneSubmission(params: {
    milestoneId: string;
    submissionId: string;
    approvedByUserId: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const submission = await tx.milestoneSubmission.findUnique({
        where: { id: params.submissionId },
        select: {
          id: true,
          milestoneId: true,
          status: true,
        },
      });

      if (!submission || submission.milestoneId !== params.milestoneId) {
        return null;
      }

      // Ensure only one approved submission per milestone.
      await tx.milestoneSubmission.updateMany({
        where: {
          milestoneId: params.milestoneId,
          status: 'APPROVED',
          id: { not: params.submissionId },
        },
        data: {
          status: 'REJECTED',
          approvedAt: null,
          approvedByUserId: null,
        },
      });

      const approved = await tx.milestoneSubmission.update({
        where: { id: params.submissionId },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
          approvedByUserId: params.approvedByUserId,
        },
        select: {
          id: true,
          milestoneId: true,
          status: true,
          fileName: true,
          mimeType: true,
          sizeBytes: true,
          fileUrl: true,
          filePublicId: true,
          resourceType: true,
          approvedAt: true,
          approvedByUserId: true,
        },
      });

      await tx.milestone.update({
        where: { id: params.milestoneId },
        data: {
          status: 'APPROVED',
        },
      });

      return approved;
    });
  }

  async listAdvisorProjectsDetailed(advisorUserId: string) {
    const projectsRaw = await this.prisma.project.findMany({
      where: { advisorId: advisorUserId },
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        proposal: {
          select: {
            id: true,
            projectGroup: {
              select: {
                id: true,
                name: true,
                objectives: true,
                technologies: true,
                status: true,
                leader: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    avatarUrl: true,
                    student: {
                      select: {
                        id: true,
                        bio: true,
                        githubUrl: true,
                        linkedinUrl: true,
                        portfolioUrl: true,
                        techStack: true,
                      },
                    },
                  },
                },
                members: {
                  orderBy: { joinedAt: 'asc' },
                  select: {
                    user: {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        avatarUrl: true,
                        student: {
                          select: {
                            id: true,
                            bio: true,
                            githubUrl: true,
                            linkedinUrl: true,
                            portfolioUrl: true,
                            techStack: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    // If multiple projects exist for the same group, keep only the latest one.
    const projects = this.dedupeProjectsByGroupLatest(projectsRaw);

    const projectIds = projects.map((p) => p.id);
    const milestoneCountsByProjectId = new Map<
      string,
      {
        total: number;
        approved: number;
        pending: number;
        submitted: number;
        rejected: number;
      }
    >();

    const milestoneDetailsByProjectId = new Map<
      string,
      {
        id: string;
        title: string;
        description: string | null;
        dueDate: Date;
        status: MilestoneStatus;
        submittedAt: Date | null;
      }[]
    >();

    if (projectIds.length) {
      const grouped = await this.prisma.milestone.groupBy({
        by: ['projectId', 'status'],
        where: { projectId: { in: projectIds } },
        _count: { _all: true },
      });

      for (const row of grouped) {
        const projectId = row.projectId;
        const status = String((row as any).status ?? '');
        const count = Number((row as any)?._count?._all ?? 0);

        const existing =
          milestoneCountsByProjectId.get(projectId) ??
          ({ total: 0, approved: 0, pending: 0, submitted: 0, rejected: 0 } as const);

        const next = {
          total: existing.total + count,
          approved: existing.approved,
          pending: existing.pending,
          submitted: existing.submitted,
          rejected: existing.rejected,
        };

        if (status === 'APPROVED') next.approved += count;
        if (status === 'PENDING') next.pending += count;
        if (status === 'SUBMITTED') next.submitted += count;
        if (status === 'REJECTED') next.rejected += count;

        milestoneCountsByProjectId.set(projectId, next);
      }

      const milestones = await this.prisma.milestone.findMany({
        where: { projectId: { in: projectIds } },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          projectId: true,
          title: true,
          description: true,
          dueDate: true,
          status: true,
          submittedAt: true,
        },
      });

      for (const m of milestones) {
        const list = milestoneDetailsByProjectId.get(m.projectId) ?? [];
        list.push({
          id: m.id,
          title: m.title,
          description: m.description ?? null,
          dueDate: m.dueDate,
          status: m.status,
          submittedAt: m.submittedAt ?? null,
        });
        milestoneDetailsByProjectId.set(m.projectId, list);
      }
    }

    return projects.map((project) => {
      const counts = milestoneCountsByProjectId.get(project.id) ?? {
        total: 0,
        approved: 0,
        pending: 0,
        submitted: 0,
        rejected: 0,
      };

      const milestoneDetails = milestoneDetailsByProjectId.get(project.id) ?? [];

      const percent = counts.total ? Math.floor((counts.approved / counts.total) * 100) : 0;

      const group = project.proposal?.projectGroup
        ? {
            id: project.proposal.projectGroup.id,
            name: project.proposal.projectGroup.name,
            objectives: project.proposal.projectGroup.objectives ?? null,
            technologies: project.proposal.projectGroup.technologies ?? null,
            status: project.proposal.projectGroup.status,
            leader: project.proposal.projectGroup.leader,
            members: project.proposal.projectGroup.members.map((m) => m.user),
            studentCount: project.proposal.projectGroup.members.length + 1,
          }
        : null;

      return {
        id: project.id,
        title: project.title,
        status: project.status,
        startedAt: project.createdAt,
        group,
        milestones: {
          total: counts.total,
          completed: counts.approved,
          approved: counts.approved,
          pending: counts.pending,
          submitted: counts.submitted,
          rejected: counts.rejected,
          progressPercent: percent,
          details: milestoneDetails,
        },
      };
    });
  }

  // Advisor methods
  async findAdvisorsByDepartment(departmentId: string, includeLoad: boolean = false) {
    const advisors = await this.prisma.advisor.findMany({
      where: { departmentId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { user: { firstName: 'asc' } },
    });

    if (!includeLoad) {
      return advisors;
    }

    // Add load information
    return Promise.all(
      advisors.map(async (advisor) => {
        const projectCount = await this.prisma.project.count({
          where: { advisorId: advisor.userId, status: 'ACTIVE' },
        });
        return {
          ...advisor,
          currentLoad: projectCount,
        };
      })
    );
  }

  async findAdvisorById(id: string) {
    return this.prisma.advisor.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            tenantId: true,
            firstName: true,
            lastName: true,
            email: true,
            status: true,
          },
        },
      },
    });
  }

  async findAdvisorByUserId(userId: string) {
    return this.prisma.advisor.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            tenantId: true,
            firstName: true,
            lastName: true,
            email: true,
            status: true,
          },
        },
      },
    });
  }

  async listDepartmentProposalReviewerUserIds(tenantId: string, departmentId: string) {
    const users = await this.prisma.user.findMany({
      where: {
        tenantId,
        departmentId,
        status: 'ACTIVE',
        roles: {
          some: {
            revokedAt: null,
            role: {
              name: {
                in: [ROLES.DEPARTMENT_HEAD, ROLES.COORDINATOR],
              },
            },
          },
        },
      },
      select: { id: true },
    });

    return users.map((user) => user.id);
  }

  async listDepartmentProposalReviewerContacts(tenantId: string, departmentId: string) {
    return this.prisma.user.findMany({
      where: {
        tenantId,
        departmentId,
        status: 'ACTIVE',
        roles: {
          some: {
            revokedAt: null,
            role: {
              name: {
                in: [ROLES.DEPARTMENT_HEAD, ROLES.COORDINATOR],
              },
            },
          },
        },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    });
  }

  async listApprovedGroupMemberUserIdsForStudent(params: {
    tenantId: string;
    departmentId: string;
    studentUserId: string;
  }) {
    const group = await this.prisma.projectGroup.findFirst({
      where: {
        tenantId: params.tenantId,
        departmentId: params.departmentId,
        status: 'APPROVED',
        OR: [
          { leaderUserId: params.studentUserId },
          { members: { some: { userId: params.studentUserId } } },
        ],
      },
      select: {
        id: true,
        leaderUserId: true,
        members: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!group) {
      return {
        projectGroupId: null,
        memberUserIds: [] as string[],
      };
    }

    return {
      projectGroupId: group.id,
      memberUserIds: Array.from(
        new Set([group.leaderUserId, ...group.members.map((member) => member.userId)])
      ),
    };
  }

  async getAdvisorWorkload(advisorId: string) {
    const advisor = await this.prisma.advisor.findUnique({
      where: { id: advisorId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
      },
    });

    if (!advisor) return null;

    const projects = await this.prisma.project.findMany({
      where: { advisorId: advisor.userId, status: 'ACTIVE' },
      select: { id: true, title: true, status: true, createdAt: true },
    });

    return {
      ...advisor,
      availableCapacity: advisor.loadLimit - advisor.currentLoad,
      projects,
    };
  }

  async getAdvisorSummary(advisorId: string) {
    const advisor = await this.prisma.advisor.findUnique({
      where: { id: advisorId },
      include: {
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
    });

    if (!advisor) return null;

    const projectsRaw = await this.prisma.project.findMany({
      // Advisor "current advising" view: ACTIVE projects only.
      where: { advisorId: advisor.userId, status: 'ACTIVE' },
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        proposal: {
          select: {
            id: true,
            title: true,
            projectGroup: {
              select: {
                id: true,
                name: true,
                objectives: true,
                technologies: true,
                status: true,
                leader: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    avatarUrl: true,
                    student: {
                      select: {
                        id: true,
                        bio: true,
                        githubUrl: true,
                        linkedinUrl: true,
                        portfolioUrl: true,
                        techStack: true,
                      },
                    },
                  },
                },
                members: {
                  orderBy: { joinedAt: 'asc' },
                  select: {
                    userId: true,
                    user: {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        avatarUrl: true,
                        student: {
                          select: {
                            id: true,
                            bio: true,
                            githubUrl: true,
                            linkedinUrl: true,
                            portfolioUrl: true,
                            techStack: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        members: {
          where: { role: 'STUDENT' },
          select: {
            userId: true,
          },
        },
      },
    });

    // If multiple ACTIVE projects exist for the same group, keep only the latest one.
    const projects = this.dedupeProjectsByGroupLatest(projectsRaw);

    const uniqueStudentIds = new Set<string>();
    const uniqueGroupIds = new Set<string>();

    // "Under supervision" (any status): used for totals that should remain accurate
    // even after projects become COMPLETED/CANCELLED.
    const allAssignedProjectsForCounts = await this.prisma.project.findMany({
      where: { advisorId: advisor.userId },
      select: {
        proposal: {
          select: {
            projectGroup: {
              select: {
                id: true,
              },
            },
          },
        },
        members: {
          where: { role: 'STUDENT' },
          select: { userId: true },
        },
      },
    });

    const uniqueStudentIdsAll = new Set<string>();
    const uniqueGroupIdsAll = new Set<string>();

    for (const item of allAssignedProjectsForCounts) {
      const groupId = item?.proposal?.projectGroup?.id;
      if (groupId) {
        uniqueGroupIdsAll.add(groupId);
      }

      for (const member of item.members ?? []) {
        if (member?.userId) {
          uniqueStudentIdsAll.add(member.userId);
        }
      }
    }

    const projectStatusCounts = {
      ACTIVE: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };

    // Compute status breakdown across ALL projects assigned to this advisor.
    // If multiple projects exist for the same group, count only the latest one.
    const allAssignedForStatus = await this.prisma.project.findMany({
      where: { advisorId: advisor.userId },
      select: {
        id: true,
        status: true,
        createdAt: true,
        proposal: {
          select: {
            projectGroup: {
              select: { id: true },
            },
          },
        },
      },
    });

    const allAssignedDeduped = this.dedupeProjectsByGroupLatest(allAssignedForStatus);
    for (const item of allAssignedDeduped) {
      if (item.status === 'ACTIVE') projectStatusCounts.ACTIVE += 1;
      if (item.status === 'COMPLETED') projectStatusCounts.COMPLETED += 1;
      if (item.status === 'CANCELLED') projectStatusCounts.CANCELLED += 1;
    }

    for (const project of projects) {
      for (const member of project.members) {
        if (member.userId) {
          uniqueStudentIds.add(member.userId);
        }
      }

      const projectGroupId = project.proposal?.projectGroup?.id;
      if (projectGroupId) {
        uniqueGroupIds.add(projectGroupId);
      }
    }

    return {
      advisor: {
        id: advisor.user.id,
        advisorProfileId: advisor.id,
        firstName: advisor.user.firstName,
        lastName: advisor.user.lastName,
        fullName: `${String(advisor.user.firstName ?? '').trim()} ${String(advisor.user.lastName ?? '').trim()}`.trim(),
        email: advisor.user.email,
        avatarUrl: advisor.user.avatarUrl ?? null,
      },
      metrics: {
        // Keep legacy totals aligned with the ACTIVE-only projects list ("currently advising").
        totalProjectsAdvising: projects.length,
        totalGroupsAdvising: uniqueGroupIds.size,
        totalStudentsAdvising: uniqueStudentIds.size,
        // Totals across ALL assigned projects (any status).
        totalGroupsSupervising: uniqueGroupIdsAll.size,
        totalStudentsSupervising: uniqueStudentIdsAll.size,
        // All assigned projects (historical) by status; updates when projects become COMPLETED/CANCELLED.
        projectStatusCounts,
        totalProjectsAssigned:
          projectStatusCounts.ACTIVE + projectStatusCounts.COMPLETED + projectStatusCounts.CANCELLED,
      },
      projects: projects.map((project) => ({
        id: project.id,
        title: project.title,
        status: project.status,
        startedAt: project.createdAt,
        proposal: project.proposal
          ? {
              id: project.proposal.id,
              title: project.proposal.title,
            }
          : null,
        group: project.proposal?.projectGroup
          ? {
              id: project.proposal.projectGroup.id,
              name: project.proposal.projectGroup.name,
              objectives: project.proposal.projectGroup.objectives ?? null,
              technologies: project.proposal.projectGroup.technologies ?? null,
              status: project.proposal.projectGroup.status,
              leader: project.proposal.projectGroup.leader,
              members: project.proposal.projectGroup.members.map((member) => member.user),
              studentCount: project.proposal.projectGroup.members.length + 1,
            }
          : null,
      })),
    };
  }

  async checkAdvisorAvailability(departmentId: string, minCapacity: number = 1) {
    const advisors = await this.prisma.advisor.findMany({
      where: { departmentId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    // Filter advisors with sufficient capacity
    const availableAdvisors = [];
    for (const advisor of advisors) {
      const activeProjects = await this.prisma.project.count({
        where: { advisorId: advisor.userId, status: 'ACTIVE' },
      });
      if (advisor.loadLimit - activeProjects >= minCapacity) {
        availableAdvisors.push({
          ...advisor,
          currentLoad: activeProjects,
        });
      }
    }

    return availableAdvisors.sort((a, b) => a.currentLoad - b.currentLoad);
  }

  async updateAdvisorLoadLimit(advisorId: string, loadLimit: number) {
    return this.prisma.advisor.update({
      where: { id: advisorId },
      data: { loadLimit },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
  }

  async incrementAdvisorLoad(advisorId: string) {
    return this.prisma.advisor.update({
      where: { id: advisorId },
      data: { currentLoad: { increment: 1 } },
    });
  }

  async decrementAdvisorLoad(advisorId: string) {
    return this.prisma.advisor.update({
      where: { id: advisorId },
      data: { currentLoad: { decrement: 1 } },
    });
  }
}
