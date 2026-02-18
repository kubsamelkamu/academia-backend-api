import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  DepartmentNotFoundException,
  FreePlanNotConfiguredException,
  PlanLimitExceededException,
} from '../../../common/exceptions';

@Injectable()
export class DepartmentUsageService {
  constructor(private readonly prisma: PrismaService) {}

  async incrementStorageUsageBytes(tenantId: string, departmentId: string, deltaBytes: number) {
    const usage = await this.ensureUsageRow(tenantId, departmentId);
    const current = Number(usage.storageUsedBytes ?? 0);
    const next = Math.max(0, current + deltaBytes);

    return this.prisma.departmentUsage.update({
      where: { id: usage.id },
      data: {
        storageUsedBytes: BigInt(next),
      },
    });
  }

  async incrementEmailSentCount(tenantId: string, departmentId: string, count: number = 1) {
    const usage = await this.ensureUsageRow(tenantId, departmentId);

    return this.prisma.departmentUsage.update({
      where: { id: usage.id },
      data: {
        emailSentCount: { increment: Math.max(0, count) },
      },
    });
  }

  async incrementReportExportsCount(tenantId: string, departmentId: string, count: number = 1) {
    const usage = await this.ensureUsageRow(tenantId, departmentId);

    return this.prisma.departmentUsage.update({
      where: { id: usage.id },
      data: {
        reportExportsCount: { increment: Math.max(0, count) },
      },
    });
  }

  async incrementApiCallsCount(tenantId: string, departmentId: string, count: number = 1) {
    const usage = await this.ensureUsageRow(tenantId, departmentId);

    return this.prisma.departmentUsage.update({
      where: { id: usage.id },
      data: {
        apiCallsCount: { increment: Math.max(0, count) },
      },
    });
  }

  async assertCanCreateUser(tenantId: string, departmentId: string) {
    const { plan, usage } = await this.getDepartmentPlanAndUsage(tenantId, departmentId);
    const features = (plan.features as Record<string, unknown>) ?? {};
    const maxUsers = Number(features.maxUsers ?? 0);

    if (maxUsers > 0 && usage.usersCount >= maxUsers) {
      throw new PlanLimitExceededException('User limit reached for current plan. Upgrade to continue.');
    }
  }

  async assertCanCreateProject(tenantId: string, departmentId: string) {
    const { plan, usage } = await this.getDepartmentPlanAndUsage(tenantId, departmentId);
    const features = (plan.features as Record<string, unknown>) ?? {};
    const maxProjects = Number(features.maxProjects ?? 0);

    if (maxProjects > 0 && usage.projectsCount >= maxProjects) {
      throw new PlanLimitExceededException(
        'Project limit reached for current plan. Upgrade to continue.'
      );
    }
  }

  async refreshDepartmentUsage(tenantId: string, departmentId: string) {
    const { subscription } = await this.ensureDepartmentSubscriptionWithPlan(tenantId, departmentId);
    const period = this.resolveUsagePeriod(subscription.currentPeriodStart, subscription.currentPeriodEnd);

    const [usersCount, projectsCount] = await this.prisma.$transaction([
      this.prisma.user.count({
        where: {
          tenantId,
          departmentId,
          deletedAt: null,
        },
      }),
      this.prisma.project.count({
        where: {
          tenantId,
          departmentId,
        },
      }),
    ]);

    return this.prisma.departmentUsage.upsert({
      where: {
        departmentId_periodStart_periodEnd: {
          departmentId,
          periodStart: period.start,
          periodEnd: period.end,
        },
      },
      create: {
        departmentId,
        periodStart: period.start,
        periodEnd: period.end,
        usersCount,
        projectsCount,
      },
      update: {
        usersCount,
        projectsCount,
      },
    });
  }

  async getDepartmentPlanAndUsage(tenantId: string, departmentId: string) {
    const { plan, subscription } = await this.ensureDepartmentSubscriptionWithPlan(tenantId, departmentId);
    const period = this.resolveUsagePeriod(subscription.currentPeriodStart, subscription.currentPeriodEnd);

    const usage = await this.refreshDepartmentUsage(tenantId, departmentId);

    return {
      plan,
      usage,
      period,
    };
  }

  private async ensureUsageRow(tenantId: string, departmentId: string) {
    const { subscription } = await this.ensureDepartmentSubscriptionWithPlan(tenantId, departmentId);
    const period = this.resolveUsagePeriod(subscription.currentPeriodStart, subscription.currentPeriodEnd);

    return this.prisma.departmentUsage.upsert({
      where: {
        departmentId_periodStart_periodEnd: {
          departmentId,
          periodStart: period.start,
          periodEnd: period.end,
        },
      },
      create: {
        departmentId,
        periodStart: period.start,
        periodEnd: period.end,
      },
      update: {},
    });
  }

  private async ensureDepartmentSubscriptionWithPlan(tenantId: string, departmentId: string) {
    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, tenantId },
      select: { id: true },
    });

    if (!department) {
      throw new DepartmentNotFoundException();
    }

    const freePlan = await this.prisma.subscriptionPlan.findFirst({
      where: { name: 'Free', isActive: true },
      select: { id: true },
    });

    if (!freePlan) {
      throw new FreePlanNotConfiguredException();
    }

    const subscription = await this.prisma.departmentSubscription.upsert({
      where: { departmentId },
      create: {
        departmentId,
        planId: freePlan.id,
        status: 'active',
        cancelAtPeriodEnd: false,
      },
      update: {},
      include: {
        plan: true,
      },
    });

    return {
      subscription,
      plan: subscription.plan,
    };
  }

  private resolveUsagePeriod(currentPeriodStart: Date | null, currentPeriodEnd: Date | null) {
    if (currentPeriodStart && currentPeriodEnd) {
      return {
        start: currentPeriodStart,
        end: currentPeriodEnd,
      };
    }

    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));

    return { start, end };
  }
}
