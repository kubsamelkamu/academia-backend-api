import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { PaddleWebhookService } from '../../subscription/webhooks/paddle-webhook.service';
import {
  DepartmentNotFoundException,
  DepartmentSubscriptionNotFoundException,
  DepartmentSubscriptionNotProException,
  FreePlanNotConfiguredException,
  TenantNotFoundException,
  TenantSubscriptionNotFoundException,
  TenantSubscriptionNotPremiumException,
} from '../../../common/exceptions';
import { AdminOverrideDepartmentSubscriptionDto } from './dto/admin-override-department-subscription.dto';

@Injectable()
export class AdminSubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paddleWebhookService: PaddleWebhookService
  ) {}

  private async logBillingAdminAudit(params: {
    actorUserId: string;
    action: string;
    targetType: string;
    targetId: string;
    reason?: string;
    metadata?: Record<string, unknown>;
  }) {
    await this.prisma.billingAdminAudit.create({
      data: {
        actorUserId: params.actorUserId,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        reason: params.reason,
        metadata: params.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  private async getProPlan() {
    const proPlan = await this.prisma.subscriptionPlan.findFirst({
      where: { name: 'Pro' },
      select: { id: true, name: true, price: true, billingCycle: true, isActive: true },
    });

    if (!proPlan) {
      throw new InternalServerErrorException('Pro plan is not configured');
    }

    return proPlan;
  }

  private async getFreePlan() {
    const freePlan = await this.prisma.subscriptionPlan.findFirst({
      where: { name: 'Free' },
      select: { id: true, name: true, price: true, billingCycle: true, isActive: true },
    });

    if (!freePlan) {
      throw new FreePlanNotConfiguredException();
    }

    return freePlan;
  }

  async listPlans(options: { includeInactive?: boolean }) {
    try {
      const includeInactive = options.includeInactive ?? false;

      const plans = await this.prisma.subscriptionPlan.findMany({
        where: includeInactive ? undefined : { isActive: true },
        orderBy: [{ price: 'asc' }, { name: 'asc' }],
      });

      return { data: plans };
    } catch {
      throw new InternalServerErrorException('Failed to list subscription plans');
    }
  }

  async getTenantSubscription(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, domain: true, status: true },
    });
    if (!tenant) {
      throw new TenantNotFoundException();
    }

    const freePlan = await this.getFreePlan();

    const subscription = await this.prisma.tenantSubscription.upsert({
      where: { tenantId },
      create: {
        tenantId,
        planId: freePlan.id,
        status: 'active',
        cancelAtPeriodEnd: false,
      },
      update: {},
      include: {
        plan: true,
      },
    });

    return { tenant, subscription };
  }

  async downgradeTenantAtPeriodEnd(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, domain: true, status: true },
    });
    if (!tenant) {
      throw new TenantNotFoundException();
    }

    const subscription = await this.prisma.tenantSubscription.findUnique({
      where: { tenantId },
      include: { plan: true },
    });

    if (!subscription) {
      throw new TenantSubscriptionNotFoundException();
    }

    if (subscription.plan?.name !== 'Pro') {
      throw new TenantSubscriptionNotPremiumException();
    }

    const updated = await this.prisma.tenantSubscription.update({
      where: { tenantId },
      data: {
        cancelAtPeriodEnd: true,
      },
      include: { plan: true },
    });

    return {
      tenant,
      subscription: updated,
      effectiveDowngradeAt: updated.currentPeriodEnd,
      message: updated.currentPeriodEnd
        ? 'Downgrade scheduled at end of current billing period'
        : 'Downgrade scheduled (currentPeriodEnd is not set yet)',
    };
  }

  async setTenantPlanLocal(tenantId: string, planName: 'Free' | 'Pro') {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, domain: true, status: true },
    });

    if (!tenant) {
      throw new TenantNotFoundException();
    }

    const plan = await this.prisma.subscriptionPlan.findFirst({
      where: { name: planName },
    });

    if (!plan) {
      if (planName === 'Free') {
        throw new FreePlanNotConfiguredException();
      }
      throw new InternalServerErrorException('Pro plan is not configured');
    }

    const now = new Date();
    const inThirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const subscription = await this.prisma.tenantSubscription.upsert({
      where: { tenantId },
      create: {
        tenantId,
        planId: plan.id,
        status: 'active',
        cancelAtPeriodEnd: false,
        currentPeriodStart: planName === 'Pro' ? now : null,
        currentPeriodEnd: planName === 'Pro' ? inThirtyDays : null,
      },
      update: {
        planId: plan.id,
        status: 'active',
        cancelAtPeriodEnd: false,
        currentPeriodStart: planName === 'Pro' ? now : null,
        currentPeriodEnd: planName === 'Pro' ? inThirtyDays : null,
      },
      include: { plan: true },
    });

    return {
      tenant,
      subscription,
      note:
        planName === 'Pro'
          ? 'Local-only Pro set for testing (mock 30-day period)'
          : 'Local-only Free set for testing',
    };
  }

  private async assertTenantAndDepartment(tenantId: string, departmentId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, domain: true, status: true },
    });
    if (!tenant) {
      throw new TenantNotFoundException();
    }

    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, tenantId },
      select: {
        id: true,
        tenantId: true,
        name: true,
        code: true,
        headOfDepartmentId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!department) {
      throw new DepartmentNotFoundException();
    }

    return { tenant, department };
  }

  async getDepartmentSubscription(tenantId: string, departmentId: string) {
    const { tenant, department } = await this.assertTenantAndDepartment(tenantId, departmentId);
    const freePlan = await this.getFreePlan();

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

    return { tenant, department, subscription };
  }

  async downgradeDepartmentAtPeriodEnd(tenantId: string, departmentId: string) {
    const { tenant, department } = await this.assertTenantAndDepartment(tenantId, departmentId);

    const subscription = await this.prisma.departmentSubscription.findUnique({
      where: { departmentId },
      include: { plan: true },
    });

    if (!subscription) {
      throw new DepartmentSubscriptionNotFoundException();
    }

    if (subscription.plan?.name !== 'Pro') {
      throw new DepartmentSubscriptionNotProException();
    }

    const updated = await this.prisma.departmentSubscription.update({
      where: { departmentId },
      data: {
        cancelAtPeriodEnd: true,
      },
      include: { plan: true },
    });

    return {
      tenant,
      department,
      subscription: updated,
      effectiveDowngradeAt: updated.currentPeriodEnd,
      message: updated.currentPeriodEnd
        ? 'Downgrade scheduled at end of current billing period'
        : 'Downgrade scheduled (currentPeriodEnd is not set yet)',
    };
  }

  async setDepartmentPlanLocal(tenantId: string, departmentId: string, planName: 'Free' | 'Pro') {
    const { tenant, department } = await this.assertTenantAndDepartment(tenantId, departmentId);

    let plan =
      planName === 'Free'
        ? await this.getFreePlan()
        : await this.getProPlan();

    if (!plan) {
      if (planName === 'Free') {
        throw new FreePlanNotConfiguredException();
      }
      throw new InternalServerErrorException('Pro plan is not configured');
    }

    const now = new Date();
    const inThirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const subscription = await this.prisma.departmentSubscription.upsert({
      where: { departmentId },
      create: {
        departmentId,
        planId: plan.id,
        status: 'active',
        cancelAtPeriodEnd: false,
        currentPeriodStart: planName === 'Pro' ? now : null,
        currentPeriodEnd: planName === 'Pro' ? inThirtyDays : null,
      },
      update: {
        planId: plan.id,
        status: 'active',
        cancelAtPeriodEnd: false,
        currentPeriodStart: planName === 'Pro' ? now : null,
        currentPeriodEnd: planName === 'Pro' ? inThirtyDays : null,
      },
      include: { plan: true },
    });

    return {
      tenant,
      department,
      subscription,
      note:
        planName === 'Pro'
          ? 'Local-only Pro set for testing (mock 30-day period)'
          : 'Local-only Free set for testing',
    };
  }

  async overrideDepartmentSubscription(
    tenantId: string,
    departmentId: string,
    actorUserId: string,
    dto: AdminOverrideDepartmentSubscriptionDto
  ) {
    const { tenant, department } = await this.assertTenantAndDepartment(tenantId, departmentId);

    const plan = await this.prisma.subscriptionPlan.findFirst({
      where: { name: dto.planName, isActive: true },
      select: { id: true, name: true },
    });

    if (!plan) {
      if (dto.planName === 'Free') {
        throw new FreePlanNotConfiguredException();
      }
      throw new InternalServerErrorException('Pro plan is not configured');
    }

    const now = new Date();
    const inThirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const subscription = await this.prisma.departmentSubscription.upsert({
      where: { departmentId },
      create: {
        departmentId,
        planId: plan.id,
        status: dto.status ?? 'active',
        cancelAtPeriodEnd: dto.cancelAtPeriodEnd ?? false,
        currentPeriodStart: dto.planName === 'Pro' ? now : null,
        currentPeriodEnd: dto.planName === 'Pro' ? inThirtyDays : null,
      },
      update: {
        planId: plan.id,
        status: dto.status ?? undefined,
        cancelAtPeriodEnd: dto.cancelAtPeriodEnd ?? undefined,
        currentPeriodStart: dto.planName === 'Pro' ? now : null,
        currentPeriodEnd: dto.planName === 'Pro' ? inThirtyDays : null,
      },
      include: { plan: true },
    });

    await this.logBillingAdminAudit({
      actorUserId,
      action: 'department_subscription_override',
      targetType: 'department_subscription',
      targetId: departmentId,
      reason: dto.reason,
      metadata: {
        tenantId,
        departmentId,
        planName: dto.planName,
        status: dto.status ?? subscription.status,
        cancelAtPeriodEnd:
          dto.cancelAtPeriodEnd ?? subscription.cancelAtPeriodEnd,
      },
    });

    return {
      tenant,
      department,
      subscription,
      message: 'Department subscription overridden by platform admin',
    };
  }

  async retryWebhookEvent(providerEventId: string, actorUserId: string, reason?: string) {
    const result = await this.paddleWebhookService.retryStoredEvent(providerEventId);

    await this.logBillingAdminAudit({
      actorUserId,
      action: 'webhook_retry',
      targetType: 'billing_webhook_event',
      targetId: providerEventId,
      reason,
      metadata: {
        result,
      },
    });

    return result;
  }

  async listBillingAudit(limit?: number) {
    const safeLimit = Number.isFinite(limit) && limit && limit > 0 ? Math.min(limit, 200) : 50;

    const items = await this.prisma.billingAdminAudit.findMany({
      orderBy: { createdAt: 'desc' },
      take: safeLimit,
    });

    return {
      count: items.length,
      items,
    };
  }
}
