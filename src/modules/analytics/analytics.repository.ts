import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AnalyticsRepository {
  constructor(private readonly prisma: PrismaService) {}

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
