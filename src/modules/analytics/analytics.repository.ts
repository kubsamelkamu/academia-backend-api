import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, ProjectGroupStatus, ProjectStatus, UserStatus } from '@prisma/client';
import { ROLES } from '../../common/constants/roles.constants';

type AdvisorOverviewOptions = {
  startDate?: Date;
  endDate?: Date;
  search?: string;
  page?: number;
  limit?: number;
  projectStatus?: ProjectStatus;
};

@Injectable()
export class AnalyticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getProjectTracking(params: {
    departmentId: string;
    search?: string;
    projectStatus?: ProjectStatus;
    page?: number;
    limit?: number;
  }) {
    const normalizedSearch = String(params.search ?? '').trim();
    const safePage = Math.max(params.page ?? 1, 1);
    const safeLimit = Math.min(Math.max(params.limit ?? 20, 1), 100);
    const skip = (safePage - 1) * safeLimit;

    const where: Prisma.ProjectWhereInput = {
      departmentId: params.departmentId,
      ...(params.projectStatus ? { status: params.projectStatus } : {}),
      ...(normalizedSearch
        ? {
            OR: [
              { title: { contains: normalizedSearch, mode: 'insensitive' } },
              {
                proposal: {
                  projectGroup: {
                    name: { contains: normalizedSearch, mode: 'insensitive' },
                  },
                },
              },
              { advisor: { firstName: { contains: normalizedSearch, mode: 'insensitive' } } },
              { advisor: { lastName: { contains: normalizedSearch, mode: 'insensitive' } } },
              { advisor: { email: { contains: normalizedSearch, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [totalItems, statusCounts, projects] = await Promise.all([
      this.prisma.project.count({ where }),
      this.prisma.project.groupBy({
        by: ['status'],
        where,
        _count: { status: true },
      }),
      this.prisma.project.findMany({
        where,
        skip,
        take: safeLimit,
        orderBy: [{ createdAt: 'desc' }],
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          advisor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatarUrl: true,
            },
          },
          proposal: {
            select: {
              id: true,
              title: true,
              projectGroup: {
                select: {
                  id: true,
                  name: true,
                  status: true,
                  objectives: true,
                  technologies: true,
                  leader: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                      email: true,
                      avatarUrl: true,
                      status: true,
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
                      joinedAt: true,
                      user: {
                        select: {
                          id: true,
                          firstName: true,
                          lastName: true,
                          email: true,
                          avatarUrl: true,
                          status: true,
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
          milestones: {
            orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
            select: {
              id: true,
              title: true,
              description: true,
              status: true,
              dueDate: true,
              submittedAt: true,
              feedback: true,
              createdAt: true,
              updatedAt: true,
              submissions: {
                where: { status: 'APPROVED' },
                orderBy: [{ approvedAt: 'desc' }, { createdAt: 'desc' }],
                take: 1,
                select: {
                  id: true,
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
      }),
    ]);

    const countsByStatus = {
      ACTIVE: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };

    for (const item of statusCounts) {
      countsByStatus[item.status] = item._count.status;
    }

    const items = projects.map((project) => {
      const approvedMilestones = project.milestones.filter(
        (milestone) => milestone.status === 'APPROVED'
      ).length;
      const submittedMilestones = project.milestones.filter(
        (milestone) => milestone.status === 'SUBMITTED'
      ).length;
      const rejectedMilestones = project.milestones.filter(
        (milestone) => milestone.status === 'REJECTED'
      ).length;
      const pendingMilestones = project.milestones.filter(
        (milestone) => milestone.status === 'PENDING'
      ).length;
      const totalMilestones = project.milestones.length;
      const milestonePercentage =
        totalMilestones > 0 ? (approvedMilestones / totalMilestones) * 100 : 0;

      const group = project.proposal?.projectGroup;

      return {
        projectId: project.id,
        projectTitle: project.title,
        projectDescription: project.description ?? null,
        projectStatus: project.status,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        proposal: project.proposal
          ? {
              id: project.proposal.id,
              title: project.proposal.title,
            }
          : null,
        advisor: project.advisor
          ? {
              id: project.advisor.id,
              firstName: project.advisor.firstName,
              lastName: project.advisor.lastName,
              fullName: `${String(project.advisor.firstName ?? '').trim()} ${String(project.advisor.lastName ?? '').trim()}`.trim(),
              email: project.advisor.email,
              avatarUrl: project.advisor.avatarUrl ?? null,
            }
          : null,
        group: group
          ? {
              id: group.id,
              name: group.name,
              status: group.status,
              objectives: group.objectives ?? null,
              technologies: group.technologies ?? null,
              leader: group.leader
                ? {
                    id: group.leader.id,
                    firstName: group.leader.firstName,
                    lastName: group.leader.lastName,
                    fullName: `${String(group.leader.firstName ?? '').trim()} ${String(group.leader.lastName ?? '').trim()}`.trim(),
                    email: group.leader.email,
                    avatarUrl: group.leader.avatarUrl ?? null,
                    status: group.leader.status,
                    studentProfile: group.leader.student
                      ? {
                          id: group.leader.student.id,
                          bio: group.leader.student.bio ?? null,
                          githubUrl: group.leader.student.githubUrl ?? null,
                          linkedinUrl: group.leader.student.linkedinUrl ?? null,
                          portfolioUrl: group.leader.student.portfolioUrl ?? null,
                          techStack: group.leader.student.techStack ?? null,
                        }
                      : null,
                  }
                : null,
              members: group.members.map((member) => ({
                id: member.user.id,
                firstName: member.user.firstName,
                lastName: member.user.lastName,
                fullName: `${String(member.user.firstName ?? '').trim()} ${String(member.user.lastName ?? '').trim()}`.trim(),
                email: member.user.email,
                avatarUrl: member.user.avatarUrl ?? null,
                status: member.user.status,
                joinedAt: member.joinedAt,
                studentProfile: member.user.student
                  ? {
                      id: member.user.student.id,
                      bio: member.user.student.bio ?? null,
                      githubUrl: member.user.student.githubUrl ?? null,
                      linkedinUrl: member.user.student.linkedinUrl ?? null,
                      portfolioUrl: member.user.student.portfolioUrl ?? null,
                      techStack: member.user.student.techStack ?? null,
                    }
                  : null,
              })),
              totalMembers: group.members.length + (group.leader ? 1 : 0),
            }
          : null,
        milestoneProgress: {
          percentage: Math.round(milestonePercentage * 100) / 100,
          approved: approvedMilestones,
          submitted: submittedMilestones,
          rejected: rejectedMilestones,
          pending: pendingMilestones,
          total: totalMilestones,
        },
        milestones: project.milestones.map((milestone) => {
          const approvedSubmission = milestone.submissions[0] ?? null;

          return {
            id: milestone.id,
            title: milestone.title,
            description: milestone.description ?? null,
            status: milestone.status,
            dueDate: milestone.dueDate,
            submittedAt: milestone.submittedAt ?? null,
            feedback: milestone.feedback ?? null,
            createdAt: milestone.createdAt,
            updatedAt: milestone.updatedAt,
            approvedSubmissionFile: approvedSubmission
              ? {
                  submissionId: approvedSubmission.id,
                  fileName: approvedSubmission.fileName,
                  mimeType: approvedSubmission.mimeType,
                  sizeBytes: approvedSubmission.sizeBytes,
                  fileUrl: approvedSubmission.fileUrl,
                  filePublicId: approvedSubmission.filePublicId,
                  resourceType: approvedSubmission.resourceType,
                  approvedAt: approvedSubmission.approvedAt,
                  approvedBy: approvedSubmission.approvedBy
                    ? {
                        id: approvedSubmission.approvedBy.id,
                        firstName: approvedSubmission.approvedBy.firstName,
                        lastName: approvedSubmission.approvedBy.lastName,
                        fullName: `${String(approvedSubmission.approvedBy.firstName ?? '').trim()} ${String(approvedSubmission.approvedBy.lastName ?? '').trim()}`.trim(),
                        email: approvedSubmission.approvedBy.email,
                        avatarUrl: approvedSubmission.approvedBy.avatarUrl ?? null,
                      }
                    : null,
                }
              : null,
          };
        }),
      };
    });

    const totalPages = totalItems > 0 ? Math.ceil(totalItems / safeLimit) : 0;

    return {
      departmentId: params.departmentId,
      generatedAt: new Date().toISOString(),
      summary: {
        totalProjects: totalItems,
        activeProjects: countsByStatus.ACTIVE,
        completedProjects: countsByStatus.COMPLETED,
        cancelledProjects: countsByStatus.CANCELLED,
      },
      pagination: {
        page: safePage,
        limit: safeLimit,
        totalItems,
        totalPages,
        hasNextPage: safePage < totalPages,
        hasPreviousPage: safePage > 1 && totalPages > 0,
      },
      filters: {
        search: normalizedSearch || null,
        projectStatus: params.projectStatus ?? null,
      },
      items,
    };
  }

  private dedupeProjectsByGroupLatest<
    T extends {
      id: string;
      createdAt: Date;
      proposal?: { projectGroup?: { id?: string | null } | null } | null;
    },
  >(items: T[]): T[] {
    if (!Array.isArray(items) || items.length === 0) {
      return [];
    }

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

  // Department Overview Analytics
  async getDepartmentOverview(departmentId: string, startDate?: Date, endDate?: Date) {
    const dateFilter = this.buildDateFilter(startDate, endDate);

    const [totalProjects, activeProjects, completedProjects, cancelledProjects] =
      await Promise.all([
        this.prisma.project.count({
          where: { departmentId, ...dateFilter },
        }),
        this.prisma.project.count({
          where: { departmentId, status: 'ACTIVE', ...dateFilter },
        }),
        this.prisma.project.count({
          where: { departmentId, status: 'COMPLETED', ...dateFilter },
        }),
        this.prisma.project.count({
          where: { departmentId, status: 'CANCELLED', ...dateFilter },
        }),
      ]);

    // Total students in department
    const totalStudents = await this.prisma.user.count({
      where: {
        departmentId,
        roles: { some: { role: { name: 'STUDENT' } } },
      },
    });

    // Active advisors
    const activeAdvisors = await this.prisma.advisor.count({
      where: { departmentId },
    });

    // Proposals this month
    const thisMonth = new Date();
    thisMonth.setDate(1);
    const proposalsThisMonth = await this.prisma.proposal.count({
      where: {
        departmentId,
        createdAt: { gte: thisMonth },
      },
    });

    // Milestones due this week
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const milestonesDueThisWeek = await this.prisma.milestone.count({
      where: {
        project: { departmentId },
        dueDate: { lte: nextWeek },
        status: { not: 'APPROVED' },
      },
    });

    // Average project duration (for completed projects)
    const completedProjectDurations = await this.prisma.project.findMany({
      where: { departmentId, status: 'COMPLETED', ...dateFilter },
      select: { createdAt: true, updatedAt: true },
    });

    const avgProjectDuration =
      completedProjectDurations.length > 0
        ? completedProjectDurations.reduce((sum, project) => {
            const duration = project.updatedAt.getTime() - project.createdAt.getTime();
            return sum + duration / (1000 * 60 * 60 * 24); // Convert to days
          }, 0) / completedProjectDurations.length
        : 0;

    const projects = await this.prisma.project.findMany({
      where: { departmentId, ...dateFilter },
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        advisor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
          },
        },
        proposal: {
          select: {
            projectGroup: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        milestones: {
          select: {
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const projectsWithProgress = projects.map((project) => {
      const totalMilestones = project.milestones.length;
      const completedMilestones = project.milestones.filter(
        (milestone) => milestone.status === 'APPROVED'
      ).length;
      const milestoneProgressPercent =
        totalMilestones > 0 ? (completedMilestones / totalMilestones) * 100 : 0;

      return {
        id: project.id,
        projectName: project.title,
        status: project.status,
        group: project.proposal.projectGroup
          ? {
              id: project.proposal.projectGroup.id,
              name: project.proposal.projectGroup.name,
            }
          : null,
        advisor: project.advisor,
        milestoneProgressPercent: Math.round(milestoneProgressPercent * 100) / 100,
        milestonesCompleted: completedMilestones,
        milestonesTotal: totalMilestones,
      };
    });

    return {
      totalProjects,
      activeProjects,
      completedProjects,
      cancelledProjects,
      completionRate: totalProjects > 0 ? (completedProjects / totalProjects) * 100 : 0,
      totalStudents,
      activeAdvisors,
      avgProjectDuration: Math.round(avgProjectDuration),
      proposalsThisMonth,
      milestonesDueThisWeek,
      projects: projectsWithProgress,
    };
  }

  // Project Summary Analytics
  async getProjectSummary(departmentId: string, startDate?: Date, endDate?: Date) {
    const dateFilter = this.buildDateFilter(startDate, endDate);

    // Projects by status
    const statusCounts = await this.prisma.project.groupBy({
      by: ['status'],
      where: { departmentId, ...dateFilter },
      _count: { status: true },
    });

    const byStatus = statusCounts.reduce(
      (acc, item) => {
        acc[item.status] = item._count.status;
        return acc;
      },
      {} as Record<string, number>
    );

    // Completion trends (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const completionTrends = await this.prisma.$queryRaw`
      SELECT
        DATE_TRUNC('month', "updatedAt") as month,
        COUNT(*) as completed
      FROM "projects"
      WHERE "departmentId" = ${departmentId}
        AND "status" = 'COMPLETED'
        AND "updatedAt" >= ${sixMonthsAgo}
      GROUP BY DATE_TRUNC('month', "updatedAt")
      ORDER BY month
    `;

    // Average completion time
    const avgCompletionTime = (await this.prisma.$queryRaw`
      SELECT AVG(EXTRACT(EPOCH FROM ("updatedAt" - "createdAt")) / 86400) as avg_days
      FROM "projects"
      WHERE "departmentId" = ${departmentId}
        AND "status" = 'COMPLETED'
        AND "createdAt" >= ${startDate || new Date('2020-01-01')}
        AND "updatedAt" <= ${endDate || new Date()}
    `) as { avg_days: number | null }[];

    // Projects by advisor
    const advisorStats = await this.prisma.project.groupBy({
      by: ['advisorId'],
      where: { departmentId, ...dateFilter },
      _count: { id: true },
    });

    const byAdvisor = await Promise.all(
      advisorStats.map(async (stat) => {
        if (!stat.advisorId) {
          return {
            advisorId: null,
            advisorName: 'Unassigned',
            projectCount: stat._count.id,
          };
        }

        const advisor = await this.prisma.user.findUnique({
          where: { id: stat.advisorId },
          select: { firstName: true, lastName: true },
        });
        return {
          advisorId: stat.advisorId,
          advisorName: `${advisor?.firstName} ${advisor?.lastName}`,
          projectCount: stat._count.id,
        };
      })
    );

    // Overdue milestones
    const overdueMilestones = await this.prisma.milestone.count({
      where: {
        project: { departmentId },
        dueDate: { lt: new Date() },
        status: { not: 'APPROVED' },
      },
    });

    return {
      byStatus,
      completionTrends,
      avgCompletionTime: avgCompletionTime[0]?.avg_days || 0,
      successRate: byStatus.COMPLETED
        ? (byStatus.COMPLETED / (byStatus.COMPLETED + (byStatus.CANCELLED || 0))) * 100
        : 0,
      byAdvisor,
      overdueMilestones,
    };
  }

  // Advisor Performance Analytics
  async getAdvisorPerformance(departmentId: string, startDate?: Date, endDate?: Date) {
    const dateFilter = this.buildDateFilter(startDate, endDate);

    const advisors = await this.prisma.advisor.findMany({
      where: { departmentId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    const performanceData = await Promise.all(
      advisors.map(async (advisor) => {
        // Active projects
        const activeProjects = await this.prisma.project.count({
          where: { advisorId: advisor.userId, status: 'ACTIVE' },
        });

        // Completed projects
        const completedProjects = await this.prisma.project.count({
          where: {
            advisorId: advisor.userId,
            status: 'COMPLETED',
            ...dateFilter,
          },
        });

        // Average completion time
        const completedProjectData = await this.prisma.project.findMany({
          where: {
            advisorId: advisor.userId,
            status: 'COMPLETED',
            ...dateFilter,
          },
          select: { createdAt: true, updatedAt: true },
        });

        const avgCompletionTime =
          completedProjectData.length > 0
            ? completedProjectData.reduce((sum, project) => {
                const duration = project.updatedAt.getTime() - project.createdAt.getTime();
                return sum + duration / (1000 * 60 * 60 * 24);
              }, 0) / completedProjectData.length
            : 0;

        // Milestone approval rate
        const totalMilestones = await this.prisma.milestone.count({
          where: {
            project: { advisorId: advisor.userId },
            ...dateFilter,
          },
        });

        const approvedMilestones = await this.prisma.milestone.count({
          where: {
            project: { advisorId: advisor.userId },
            status: 'APPROVED',
            ...dateFilter,
          },
        });

        const milestoneApprovalRate =
          totalMilestones > 0 ? (approvedMilestones / totalMilestones) * 100 : 0;

        return {
          advisorId: advisor.id,
          advisorName: `${advisor.user.firstName} ${advisor.user.lastName}`,
          activeProjects,
          completedProjects,
          avgCompletionTime: Math.round(avgCompletionTime),
          milestoneApprovalRate: Math.round(milestoneApprovalRate * 100) / 100,
          loadUtilization:
            advisor.loadLimit > 0 ? (advisor.currentLoad / advisor.loadLimit) * 100 : 0,
        };
      })
    );

    return performanceData;
  }

  async getAdvisorOverviewDetailed(departmentId: string, options: AdvisorOverviewOptions = {}) {
    const { startDate, endDate, search, page = 1, limit = 10, projectStatus } = options;
    const dateFilter = this.buildDateFilter(startDate, endDate);
    const normalizedSearch = String(search ?? '').trim().toLowerCase();

    const [advisorProfiles, projectsRaw] = await Promise.all([
      this.prisma.advisor.findMany({
        where: {
          departmentId,
          ...(normalizedSearch
            ? {
                user: {
                  OR: [
                    { firstName: { contains: normalizedSearch, mode: 'insensitive' } },
                    { lastName: { contains: normalizedSearch, mode: 'insensitive' } },
                    { email: { contains: normalizedSearch, mode: 'insensitive' } },
                  ],
                },
              }
            : {}),
        },
        include: {
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
        orderBy: [{ user: { firstName: 'asc' } }, { user: { lastName: 'asc' } }],
      }),
      this.prisma.project.findMany({
        where: {
          departmentId,
          ...(projectStatus ? { status: projectStatus } : {}),
          ...dateFilter,
        },
        orderBy: [{ createdAt: 'desc' }],
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          advisorId: true,
          advisor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatarUrl: true,
            },
          },
          proposal: {
            select: {
              id: true,
              title: true,
              projectGroup: {
                select: {
                  id: true,
                  name: true,
                  status: true,
                  objectives: true,
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
          milestones: {
            orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
            select: {
              id: true,
              title: true,
              description: true,
              status: true,
              dueDate: true,
              submittedAt: true,
              feedback: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      }),
    ]);

    const projects = this.dedupeProjectsByGroupLatest(projectsRaw);

    const departmentProjectStatusCounts = {
      ACTIVE: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };

    const advisorByUserId = new Map(
      advisorProfiles.map((advisor) => [
        advisor.userId,
        {
          advisorProfileId: advisor.id,
          advisorId: advisor.user.id,
          firstName: advisor.user.firstName,
          lastName: advisor.user.lastName,
          fullName: `${String(advisor.user.firstName ?? '').trim()} ${String(advisor.user.lastName ?? '').trim()}`.trim(),
          email: advisor.user.email,
          avatarUrl: advisor.user.avatarUrl ?? null,
          status: advisor.user.status,
          loadLimit: advisor.loadLimit,
          currentLoad: advisor.currentLoad,
          availableCapacity: Math.max(advisor.loadLimit - advisor.currentLoad, 0),
          metrics: {
            totalProjectsAdvising: 0,
            activeProjectsCount: 0,
            completedProjectsCount: 0,
            cancelledProjectsCount: 0,
            overallProjectProgress: 0,
          },
          projects: [] as any[],
        },
      ])
    );

    let departmentProgressSum = 0;

    for (const project of projects) {
      departmentProjectStatusCounts[project.status] += 1;

      const totalMilestones = project.milestones.length;
      const approvedMilestones = project.milestones.filter(
        (milestone) => milestone.status === 'APPROVED'
      ).length;
      const submittedMilestones = project.milestones.filter(
        (milestone) => milestone.status === 'SUBMITTED'
      ).length;
      const rejectedMilestones = project.milestones.filter(
        (milestone) => milestone.status === 'REJECTED'
      ).length;
      const pendingMilestones = project.milestones.filter(
        (milestone) => milestone.status === 'PENDING'
      ).length;
      const progressPercentage =
        totalMilestones > 0 ? (approvedMilestones / totalMilestones) * 100 : 0;

      departmentProgressSum += progressPercentage;

      if (!project.advisorId) {
        continue;
      }

      const advisorEntry = advisorByUserId.get(project.advisorId);
      if (!advisorEntry) {
        continue;
      }

      advisorEntry.metrics.totalProjectsAdvising += 1;
      if (project.status === 'ACTIVE') advisorEntry.metrics.activeProjectsCount += 1;
      if (project.status === 'COMPLETED') advisorEntry.metrics.completedProjectsCount += 1;
      if (project.status === 'CANCELLED') advisorEntry.metrics.cancelledProjectsCount += 1;

      const group = project.proposal?.projectGroup;

      advisorEntry.projects.push({
        id: project.id,
        title: project.title,
        description: project.description ?? null,
        status: project.status,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        advisor: project.advisor
          ? {
              id: project.advisor.id,
              firstName: project.advisor.firstName,
              lastName: project.advisor.lastName,
              fullName: `${String(project.advisor.firstName ?? '').trim()} ${String(project.advisor.lastName ?? '').trim()}`.trim(),
              email: project.advisor.email,
              avatarUrl: project.advisor.avatarUrl ?? null,
            }
          : null,
        proposal: project.proposal
          ? {
              id: project.proposal.id,
              title: project.proposal.title,
            }
          : null,
        progress: {
          percentage: Math.round(progressPercentage * 100) / 100,
          approvedMilestones,
          submittedMilestones,
          rejectedMilestones,
          pendingMilestones,
          totalMilestones,
        },
        milestones: project.milestones.map((milestone) => ({
          id: milestone.id,
          title: milestone.title,
          description: milestone.description ?? null,
          status: milestone.status,
          dueDate: milestone.dueDate,
          submittedAt: milestone.submittedAt ?? null,
          feedback: milestone.feedback ?? null,
          createdAt: milestone.createdAt,
          updatedAt: milestone.updatedAt,
        })),
        group: group
          ? {
              id: group.id,
              name: group.name,
              status: group.status,
              objectives: group.objectives ?? null,
              technologies: group.technologies ?? null,
              leader: group.leader
                ? {
                    id: group.leader.id,
                    firstName: group.leader.firstName,
                    lastName: group.leader.lastName,
                    fullName: `${String(group.leader.firstName ?? '').trim()} ${String(group.leader.lastName ?? '').trim()}`.trim(),
                    email: group.leader.email,
                    avatarUrl: group.leader.avatarUrl ?? null,
                    studentProfile: group.leader.student
                      ? {
                          id: group.leader.student.id,
                          bio: group.leader.student.bio ?? null,
                          githubUrl: group.leader.student.githubUrl ?? null,
                          linkedinUrl: group.leader.student.linkedinUrl ?? null,
                          portfolioUrl: group.leader.student.portfolioUrl ?? null,
                          techStack: group.leader.student.techStack ?? null,
                        }
                      : null,
                  }
                : null,
              members: group.members.map((member) => ({
                id: member.user.id,
                firstName: member.user.firstName,
                lastName: member.user.lastName,
                fullName: `${String(member.user.firstName ?? '').trim()} ${String(member.user.lastName ?? '').trim()}`.trim(),
                email: member.user.email,
                avatarUrl: member.user.avatarUrl ?? null,
                studentProfile: member.user.student
                  ? {
                      id: member.user.student.id,
                      bio: member.user.student.bio ?? null,
                      githubUrl: member.user.student.githubUrl ?? null,
                      linkedinUrl: member.user.student.linkedinUrl ?? null,
                      portfolioUrl: member.user.student.portfolioUrl ?? null,
                      techStack: member.user.student.techStack ?? null,
                    }
                  : null,
              })),
              totalMembers: group.members.length + (group.leader ? 1 : 0),
            }
          : null,
      });
    }

    const advisorsAll = Array.from(advisorByUserId.values()).map((advisor) => {
      const totalAdvisorProgress = advisor.projects.reduce(
        (sum, project) => sum + project.progress.percentage,
        0
      );
      const overallProjectProgress =
        advisor.projects.length > 0 ? totalAdvisorProgress / advisor.projects.length : 0;

      return {
        ...advisor,
        metrics: {
          ...advisor.metrics,
          overallProjectProgress: Math.round(overallProjectProgress * 100) / 100,
        },
      };
    });

    const totalAdvisorItems = advisorsAll.length;
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const safePage = Math.max(page, 1);
    const totalPages = totalAdvisorItems > 0 ? Math.ceil(totalAdvisorItems / safeLimit) : 0;
    const startIndex = (safePage - 1) * safeLimit;
    const advisors = advisorsAll.slice(startIndex, startIndex + safeLimit);

    const overallDepartmentProjectProgress =
      projects.length > 0 ? departmentProgressSum / projects.length : 0;

    return {
      departmentId,
      generatedAt: new Date().toISOString(),
      summary: {
        totalAdvisors: advisorProfiles.length,
        totalProjects: projects.length,
        assignedProjects: projects.filter((project) => Boolean(project.advisorId)).length,
        unassignedProjects: projects.filter((project) => !project.advisorId).length,
        overallDepartmentProjectProgress:
          Math.round(overallDepartmentProjectProgress * 100) / 100,
        projectStatusCounts: departmentProjectStatusCounts,
      },
      pagination: {
        page: safePage,
        limit: safeLimit,
        totalItems: totalAdvisorItems,
        totalPages,
        hasNextPage: safePage < totalPages,
        hasPreviousPage: safePage > 1 && totalPages > 0,
      },
      filters: {
        search: normalizedSearch || null,
        projectStatus: projectStatus ?? null,
        startDate: startDate?.toISOString() ?? null,
        endDate: endDate?.toISOString() ?? null,
      },
      advisors,
    };
  }

  async getAdvisorDetail(
    departmentId: string,
    advisorProfileId: string,
    options: Pick<AdvisorOverviewOptions, 'startDate' | 'endDate' | 'projectStatus'> = {}
  ) {
    const { startDate, endDate, projectStatus } = options;
    const advisor = await this.prisma.advisor.findFirst({
      where: {
        id: advisorProfileId,
        departmentId,
      },
      select: {
        id: true,
      },
    });

    if (!advisor) {
      return null;
    }

    const overview = await this.getAdvisorOverviewDetailed(departmentId, {
      startDate,
      endDate,
      projectStatus,
      page: 1,
      limit: 1000,
    });
    const advisorDetail = overview.advisors.find(
      (item) => item.advisorProfileId === advisorProfileId
    );

    if (!advisorDetail) {
      return null;
    }

    return {
      departmentId: overview.departmentId,
      generatedAt: overview.generatedAt,
      summary: overview.summary,
      advisor: advisorDetail,
    };
  }

  // Student Progress Analytics
  async getStudentProgress(departmentId: string, startDate?: Date, endDate?: Date) {
    // Total students in department
    const totalStudents = await this.prisma.user.count({
      where: {
        departmentId,
        roles: { some: { role: { name: 'STUDENT' } } },
      },
    });

    // Students with active projects
    const studentsWithProjects = await this.prisma.user.count({
      where: {
        departmentId,
        roles: { some: { role: { name: 'STUDENT' } } },
        projectMemberships: {
          some: {
            project: { status: 'ACTIVE' },
          },
        },
      },
    });

    // Average projects per student
    const totalProjectMemberships = await this.prisma.projectMember.count({
      where: {
        project: { departmentId },
        role: 'STUDENT',
      },
    });

    const avgProjectsPerStudent = totalStudents > 0 ? totalProjectMemberships / totalStudents : 0;

    // Milestone completion rate
    const totalMilestones = await this.prisma.milestone.count({
      where: {
        project: { departmentId },
        ...this.buildDateFilter(startDate, endDate),
      },
    });

    const completedMilestones = await this.prisma.milestone.count({
      where: {
        project: { departmentId },
        status: 'APPROVED',
        ...this.buildDateFilter(startDate, endDate),
      },
    });

    const milestoneCompletionRate =
      totalMilestones > 0 ? (completedMilestones / totalMilestones) * 100 : 0;

    // At-risk students (students with overdue milestones)
    const atRiskStudents = await this.prisma.$queryRaw`
      SELECT DISTINCT
        u."id",
        u."firstName",
        u."lastName",
        COUNT(m.id) as overdue_count
      FROM "users" u
      JOIN "project_members" pm ON u."id" = pm."userId"
      JOIN "projects" p ON pm."projectId" = p."id"
      JOIN "milestones" m ON p."id" = m."projectId"
      WHERE p."departmentId" = ${departmentId}
        AND m."dueDate" < NOW()
        AND m."status" != 'APPROVED'
        AND u."id" IN (
          SELECT ur."userId" FROM "user_roles" ur
          JOIN "roles" r ON ur."roleId" = r."id"
          WHERE r."name" = 'STUDENT'
        )
      GROUP BY u."id", u."firstName", u."lastName"
      HAVING COUNT(m.id) > 0
      ORDER BY overdue_count DESC
    `;

    return {
      totalStudents,
      activeStudents: studentsWithProjects, // Approximation
      studentsWithProjects,
      avgProjectsPerStudent: Math.round(avgProjectsPerStudent * 100) / 100,
      milestoneCompletionRate: Math.round(milestoneCompletionRate * 100) / 100,
      atRiskStudents,
    };
  }

  async getStudentDirectory(params: {
    departmentId: string;
    page: number;
    limit: number;
    search?: string;
    userStatus?: UserStatus;
    groupStatus?: ProjectGroupStatus;
    hasGroup?: boolean;
  }) {
    const normalizedSearch = params.search?.trim();
    const skip = (params.page - 1) * params.limit;

    const where: Prisma.UserWhereInput = {
      departmentId: params.departmentId,
      deletedAt: null,
      roles: {
        some: {
          revokedAt: null,
          role: {
            name: ROLES.STUDENT,
          },
        },
      },
      ...(params.userStatus ? { status: params.userStatus } : {}),
      ...(normalizedSearch
        ? {
            OR: [
              { firstName: { contains: normalizedSearch, mode: 'insensitive' as const } },
              { lastName: { contains: normalizedSearch, mode: 'insensitive' as const } },
              { email: { contains: normalizedSearch, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(params.hasGroup === true
        ? {
            OR: [
              { projectGroupLed: { isNot: null } },
              { projectGroupMemberships: { some: {} } },
            ],
          }
        : {}),
      ...(params.hasGroup === false
        ? {
            projectGroupLed: { is: null },
            projectGroupMemberships: { none: {} },
          }
        : {}),
      ...(params.groupStatus
        ? {
            OR: [
              { projectGroupLed: { is: { status: params.groupStatus } } },
              {
                projectGroupMemberships: {
                  some: {
                    projectGroup: {
                      status: params.groupStatus,
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const summaryStudentWhere: Prisma.UserWhereInput = {
      departmentId: params.departmentId,
      deletedAt: null,
      roles: {
        some: {
          revokedAt: null,
          role: {
            name: ROLES.STUDENT,
          },
        },
      },
    };

    const [summaryTotalStudents, filteredTotalStudents, totalProjectGroups, approvedProjectGroups, rejectedProjectGroups, students] =
      await this.prisma.$transaction([
        this.prisma.user.count({ where: summaryStudentWhere }),
        this.prisma.user.count({ where }),
        this.prisma.projectGroup.count({ where: { departmentId: params.departmentId } }),
        this.prisma.projectGroup.count({
          where: { departmentId: params.departmentId, status: 'APPROVED' },
        }),
        this.prisma.projectGroup.count({
          where: { departmentId: params.departmentId, status: 'REJECTED' },
        }),
        this.prisma.user.findMany({
          where,
          orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
          skip,
          take: params.limit,
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
            status: true,
            lastLoginAt: true,
            student: {
              select: {
                bio: true,
                githubUrl: true,
                linkedinUrl: true,
                portfolioUrl: true,
                techStack: true,
              },
            },
            projectGroupLed: {
              select: {
                id: true,
                name: true,
                status: true,
              },
            },
            projectGroupMemberships: {
              take: 1,
              select: {
                projectGroup: {
                  select: {
                    id: true,
                    name: true,
                    status: true,
                  },
                },
              },
            },
          },
        }),
      ]);

    const items = students.map((student) => {
      const membership = student.projectGroupMemberships[0]?.projectGroup ?? null;
      const leaderGroup = student.projectGroupLed ?? null;

      const group = leaderGroup
        ? {
            hasGroup: true,
            role: 'LEADER',
            id: leaderGroup.id,
            name: leaderGroup.name,
            status: leaderGroup.status,
          }
        : membership
          ? {
              hasGroup: true,
              role: 'MEMBER',
              id: membership.id,
              name: membership.name,
              status: membership.status,
            }
          : {
              hasGroup: false,
              role: null,
              id: null,
              name: null,
              status: null,
            };

      return {
        student: {
          id: student.id,
          firstName: student.firstName,
          lastName: student.lastName,
          email: student.email,
          avatarUrl: student.avatarUrl,
          userStatus: student.status,
          lastLoginAt: student.lastLoginAt,
        },
        profile: {
          bio: student.student?.bio ?? null,
          githubUrl: student.student?.githubUrl ?? null,
          linkedinUrl: student.student?.linkedinUrl ?? null,
          portfolioUrl: student.student?.portfolioUrl ?? null,
          techStack: (student.student?.techStack as string[] | null) ?? [],
        },
        group,
      };
    });

    return {
      summary: {
        totalStudents: summaryTotalStudents,
        totalProjectGroups,
        approvedProjectGroups,
        rejectedProjectGroups,
      },
      items,
      pagination: {
        total: filteredTotalStudents,
        page: params.page,
        limit: params.limit,
        pages: Math.ceil(filteredTotalStudents / params.limit),
      },
    };
  }

  // Report Data Methods
  async getProjectReportData(departmentId: string, filters: any) {
    const whereClause: any = { departmentId };

    if (filters.startDate) whereClause.createdAt = { gte: new Date(filters.startDate) };
    if (filters.endDate) whereClause.updatedAt = { lte: new Date(filters.endDate) };
    if (filters.advisorId) whereClause.advisorId = filters.advisorId;
    if (filters.status) whereClause.status = filters.status;

    return this.prisma.project.findMany({
      where: whereClause,
      include: {
        proposal: { select: { title: true, description: true, status: true } },
        advisor: { select: { firstName: true, lastName: true } },
        members: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
        milestones: {
          select: { title: true, status: true, dueDate: true, submittedAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getComplianceReportData(departmentId: string, startDate?: Date, endDate?: Date) {
    // Project approval timelines
    const projectApprovals = await this.prisma.$queryRaw`
      SELECT
        p."id",
        p."title",
        pr."createdAt" as proposal_created,
        p."createdAt" as project_created,
        EXTRACT(EPOCH FROM (p."createdAt" - pr."createdAt")) / 86400 as approval_days
      FROM "projects" p
      JOIN "proposals" pr ON p."proposalId" = pr."id"
      WHERE p."departmentId" = ${departmentId}
        AND p."createdAt" >= ${startDate || new Date('2020-01-01')}
        AND p."createdAt" <= ${endDate || new Date()}
    `;

    // Advisor workload compliance
    const advisorCompliance = await this.prisma.advisor.findMany({
      where: { departmentId },
      include: {
        user: { select: { firstName: true, lastName: true } },
      },
    });

    const advisorWorkloadData = await Promise.all(
      advisorCompliance.map(async (advisor) => {
        const activeProjects = await this.prisma.project.count({
          where: { advisorId: advisor.userId, status: 'ACTIVE' },
        });

        return {
          advisorId: advisor.id,
          advisorName: `${advisor.user.firstName} ${advisor.user.lastName}`,
          currentLoad: activeProjects,
          loadLimit: advisor.loadLimit,
          compliance: activeProjects <= advisor.loadLimit,
        };
      })
    );

    // Milestone completion rates
    const milestoneStats = (await this.prisma.$queryRaw`
      SELECT
        COUNT(*) as total_milestones,
        COUNT(CASE WHEN "status" = 'APPROVED' THEN 1 END) as completed_milestones,
        COUNT(CASE WHEN "dueDate" < NOW() AND "status" != 'APPROVED' THEN 1 END) as overdue_milestones
      FROM "milestones" m
      JOIN "projects" p ON m."projectId" = p."id"
      WHERE p."departmentId" = ${departmentId}
        AND m."createdAt" >= ${startDate || new Date('2020-01-01')}
        AND m."createdAt" <= ${endDate || new Date()}
    `) as { total_milestones: bigint; completed_milestones: bigint; overdue_milestones: bigint }[];

    return {
      projectApprovals,
      advisorWorkloadCompliance: advisorWorkloadData,
      milestoneStats: milestoneStats[0],
    };
  }

  private buildDateFilter(startDate?: Date, endDate?: Date) {
    const filter: any = {};
    if (startDate) filter.createdAt = { gte: startDate };
    if (endDate) filter.updatedAt = { lte: endDate };
    return filter;
  }
}
