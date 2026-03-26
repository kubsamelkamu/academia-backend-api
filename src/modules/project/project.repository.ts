import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { ensureDepartmentDefaultMilestoneTemplate } from '../milestone/default-department-milestone-template';
import { ROLES } from '../../common/constants/roles.constants';

@Injectable()
export class ProjectRepository {
  constructor(private readonly prisma: PrismaService) {}

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
        advisor: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findProposalById(id: string) {
    return this.prisma.proposal.findUnique({
      where: { id },
      include: {
        submitter: { select: { id: true, firstName: true, lastName: true, email: true } },
        advisor: { select: { id: true, firstName: true, lastName: true, email: true } },
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
        advisor: { select: { id: true, firstName: true, lastName: true, email: true } },
        department: { select: { id: true, name: true } },
        project: true,
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createProposal(data: {
    tenantId: string;
    departmentId: string;
    title: string;
    proposedTitles: string[];
    description?: string;
    submittedBy: string;
    documents?: unknown[];
  }) {
    const createData: any = {
      tenantId: data.tenantId,
      departmentId: data.departmentId,
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
        advisor: { select: { id: true, firstName: true, lastName: true, email: true } },
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
        advisor: { select: { id: true, firstName: true, lastName: true, email: true } },
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
        advisor: { select: { id: true, firstName: true, lastName: true, email: true } },
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
        advisor: { select: { id: true, firstName: true, lastName: true, email: true } },
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
        advisor: { select: { id: true, firstName: true, lastName: true, email: true } },
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
      include: { submitter: true, department: true },
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

      // Add submitter as student member
      await tx.projectMember.create({
        data: {
          projectId: project.id,
          userId: proposal.submittedBy,
          role: 'STUDENT',
        },
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
        const milestonesToCreate = template.milestones.map((m) => {
          cumulativeDays += m.defaultDurationDays;
          return {
            projectId: project.id,
            title: m.title,
            description: m.description,
            dueDate: this.addDays(project.createdAt, cumulativeDays),
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
            departmentId: true,
            milestoneTemplateId: true,
          },
        },
      },
    });
  }

  async updateProjectAdvisor(projectId: string, advisorId: string) {
    return this.prisma.$transaction(async (tx) => {
      // Update project advisor
      const project = await tx.project.update({
        where: { id: projectId },
        data: { advisorId },
      });

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

  async listApprovedGroupMemberUserIdsForStudent(params: {
    tenantId: string;
    departmentId: string;
    studentUserId: string;
  }) {
    const membership = await this.prisma.projectGroupMember.findFirst({
      where: {
        userId: params.studentUserId,
        projectGroup: {
          tenantId: params.tenantId,
          departmentId: params.departmentId,
          status: 'APPROVED',
        },
      },
      select: {
        projectGroup: {
          select: {
            id: true,
            members: {
              select: {
                userId: true,
              },
            },
          },
        },
      },
    });

    if (!membership?.projectGroup) {
      return {
        projectGroupId: null,
        memberUserIds: [] as string[],
      };
    }

    return {
      projectGroupId: membership.projectGroup.id,
      memberUserIds: membership.projectGroup.members.map((member) => member.userId),
    };
  }

  async getAdvisorWorkload(advisorId: string) {
    const advisor = await this.prisma.advisor.findUnique({
      where: { id: advisorId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
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
