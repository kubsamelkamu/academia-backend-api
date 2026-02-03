import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  FreePlanNotConfiguredException,
  TenantNotFoundException,
  TenantSubscriptionNotFoundException,
  TenantSubscriptionNotPremiumException,
} from '../../../common/exceptions';

@Injectable()
export class AdminSubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

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

    if (subscription.plan?.name !== 'Premium') {
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

  async setTenantPlanLocal(tenantId: string, planName: 'Free' | 'Premium') {
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
      throw new InternalServerErrorException('Premium plan is not configured');
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
        currentPeriodStart: planName === 'Premium' ? now : null,
        currentPeriodEnd: planName === 'Premium' ? inThirtyDays : null,
      },
      update: {
        planId: plan.id,
        status: 'active',
        cancelAtPeriodEnd: false,
        currentPeriodStart: planName === 'Premium' ? now : null,
        currentPeriodEnd: planName === 'Premium' ? inThirtyDays : null,
      },
      include: { plan: true },
    });

    return {
      tenant,
      subscription,
      note:
        planName === 'Premium'
          ? 'Local-only Premium set for testing (mock 30-day period)'
          : 'Local-only Free set for testing',
    };
  }
}
