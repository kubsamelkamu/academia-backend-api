import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Environment, Paddle } from '@paddle/paddle-node-sdk';
import { PrismaService } from '../../../prisma/prisma.service';
import { DepartmentNotFoundException, FreePlanNotConfiguredException } from '../../../common/exceptions';
import { DepartmentUsageService } from '../usage/department-usage.service';

type AuthUser = {
  sub: string;
  tenantId: string;
  roles?: string[];
};

@Injectable()
export class DepartmentBillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly departmentUsageService: DepartmentUsageService
  ) {}

  async getSummary(user: AuthUser, requestedDepartmentId?: string) {
    const context = await this.resolveDepartmentContext(user, requestedDepartmentId);
    const subscription = await this.ensureDepartmentSubscription(context.department.id);

    return {
      tenant: context.tenant,
      department: context.department,
      subscription,
      plan: subscription.plan,
      billing: {
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      },
    };
  }

  async getUsage(user: AuthUser, requestedDepartmentId?: string) {
    const context = await this.resolveDepartmentContext(user, requestedDepartmentId);
    const { plan, usage, period } = await this.departmentUsageService.getDepartmentPlanAndUsage(
      context.tenant.id,
      context.department.id
    );

    const features = (plan.features as Record<string, unknown>) ?? {};
    const maxUsers = Number(features.maxUsers ?? 0);
    const maxProjects = Number(features.maxProjects ?? 0);
    const storageGB = Number(features.storageGB ?? 0);

    return {
      tenant: context.tenant,
      department: context.department,
      period: {
        start: period.start,
        end: period.end,
      },
      usage: {
        users: { current: usage.usersCount, limit: maxUsers || null },
        projects: { current: usage.projectsCount, limit: maxProjects || null },
        storage: {
          currentBytes: Number(usage.storageUsedBytes),
          limitBytes: storageGB > 0 ? storageGB * 1024 * 1024 * 1024 : null,
        },
        email: { current: usage.emailSentCount, limit: Number(features.emailMonthlyLimit ?? 0) || null },
        reports: {
          current: usage.reportExportsCount,
          limit: Number(features.reportExportsPerMonth ?? 0) || null,
        },
        apiCalls: { current: usage.apiCallsCount, limit: null },
      },
    };
  }

  async createCheckoutSession(
    user: AuthUser,
    planName: 'Pro',
    requestedDepartmentId?: string,
    returnUrl?: string
  ) {
    if (planName !== 'Pro') {
      throw new BadRequestException('Only Pro checkout is supported');
    }

    const context = await this.resolveDepartmentContext(user, requestedDepartmentId);
    const subscription = await this.ensureDepartmentSubscription(context.department.id);
    const proPlan = await this.getPlanByName('Pro');

    if (!proPlan.paddlePriceId) {
      throw new InternalServerErrorException('Pro plan is missing paddlePriceId mapping');
    }

    const paddle = this.getPaddleClient();
    const transaction = await paddle.transactions.create({
      items: [{ priceId: proPlan.paddlePriceId, quantity: 1 }],
      customerId: subscription.paddleCustomerId ?? undefined,
      customData: {
        departmentId: context.department.id,
        tenantId: context.tenant.id,
        initiatedBy: user.sub,
      },
      checkout: {
        url: returnUrl ?? this.configService.get<string>('app.frontendUrl') ?? undefined,
      },
    });

    return {
      department: context.department,
      plan: { id: proPlan.id, name: proPlan.name },
      transactionId: transaction.id,
      checkoutUrl: transaction.checkout?.url ?? null,
      message: 'Complete checkout; subscription will be synchronized by webhook',
    };
  }

  async schedulePlanChange(
    user: AuthUser,
    planName: 'Free' | 'Pro',
    requestedDepartmentId?: string
  ) {
    const context = await this.resolveDepartmentContext(user, requestedDepartmentId);
    const subscription = await this.ensureDepartmentSubscription(context.department.id);

    if (planName === 'Pro') {
      if (!subscription.paddleSubscriptionId) {
        return {
          department: context.department,
          action: 'checkout_required',
          message: 'No active Paddle subscription found. Create checkout session for Pro.',
        };
      }

      const paddle = this.getPaddleClient();
      await paddle.subscriptions.update(subscription.paddleSubscriptionId, {
        scheduledChange: null,
      });

      const updated = await this.prisma.departmentSubscription.update({
        where: { departmentId: context.department.id },
        data: { cancelAtPeriodEnd: false },
        include: { plan: true },
      });

      return {
        department: context.department,
        subscription: updated,
        message: 'Department remains on Pro and any pending cancellation is removed',
      };
    }

    if (!subscription.paddleSubscriptionId) {
      const freePlan = await this.getPlanByName('Free');
      const updated = await this.prisma.departmentSubscription.update({
        where: { departmentId: context.department.id },
        data: {
          planId: freePlan.id,
          cancelAtPeriodEnd: false,
          status: 'active',
          currentPeriodStart: null,
          currentPeriodEnd: null,
        },
        include: { plan: true },
      });

      return {
        department: context.department,
        subscription: updated,
        message: 'Department is on Free plan (no Paddle subscription attached)',
      };
    }

    const paddle = this.getPaddleClient();
    await paddle.subscriptions.cancel(subscription.paddleSubscriptionId, {
      effectiveFrom: 'next_billing_period',
    });

    const updated = await this.prisma.departmentSubscription.update({
      where: { departmentId: context.department.id },
      data: { cancelAtPeriodEnd: true },
      include: { plan: true },
    });

    return {
      department: context.department,
      subscription: updated,
      message: 'Downgrade to Free scheduled at period end',
    };
  }

  async cancelAtPeriodEnd(user: AuthUser, requestedDepartmentId?: string) {
    const context = await this.resolveDepartmentContext(user, requestedDepartmentId);
    const subscription = await this.ensureDepartmentSubscription(context.department.id);

    if (!subscription.paddleSubscriptionId) {
      throw new BadRequestException('No active Paddle subscription found for this department');
    }

    const paddle = this.getPaddleClient();
    await paddle.subscriptions.cancel(subscription.paddleSubscriptionId, {
      effectiveFrom: 'next_billing_period',
    });

    const updated = await this.prisma.departmentSubscription.update({
      where: { departmentId: context.department.id },
      data: { cancelAtPeriodEnd: true },
      include: { plan: true },
    });

    return {
      department: context.department,
      subscription: updated,
      message: 'Cancellation scheduled at period end',
    };
  }

  async reactivate(user: AuthUser, requestedDepartmentId?: string) {
    const context = await this.resolveDepartmentContext(user, requestedDepartmentId);
    const subscription = await this.ensureDepartmentSubscription(context.department.id);

    if (!subscription.paddleSubscriptionId) {
      throw new BadRequestException('No Paddle subscription found for this department');
    }

    const paddle = this.getPaddleClient();
    await paddle.subscriptions.update(subscription.paddleSubscriptionId, {
      scheduledChange: null,
    });

    const updated = await this.prisma.departmentSubscription.update({
      where: { departmentId: context.department.id },
      data: { cancelAtPeriodEnd: false },
      include: { plan: true },
    });

    return {
      department: context.department,
      subscription: updated,
      message: 'Scheduled cancellation removed',
    };
  }

  async createCustomerPortalSession(user: AuthUser, requestedDepartmentId?: string) {
    const context = await this.resolveDepartmentContext(user, requestedDepartmentId);
    const subscription = await this.ensureDepartmentSubscription(context.department.id);

    if (!subscription.paddleCustomerId) {
      throw new BadRequestException('Department has no Paddle customer mapping');
    }

    const paddle = this.getPaddleClient();
    const session = await paddle.customerPortalSessions.create(
      subscription.paddleCustomerId,
      subscription.paddleSubscriptionId ? [subscription.paddleSubscriptionId] : []
    );

    return {
      department: context.department,
      portalUrl: session.urls.general.overview,
      sessionId: session.id,
    };
  }

  private getPaddleClient() {
    const apiKey = this.configService.get<string>('subscription.paddleApiKey');
    const environment = this.configService.get<string>('subscription.paddleEnvironment') || 'sandbox';

    if (!apiKey) {
      throw new InternalServerErrorException('Paddle API key is not configured');
    }

    return new Paddle(apiKey, {
      environment: environment === 'production' ? Environment.production : Environment.sandbox,
    });
  }

  private async getPlanByName(name: 'Free' | 'Pro') {
    const plan = await this.prisma.subscriptionPlan.findFirst({
      where: { name, isActive: true },
    });

    if (!plan) {
      if (name === 'Free') {
        throw new FreePlanNotConfiguredException();
      }
      throw new BadRequestException('Pro plan is not configured');
    }

    return plan;
  }

  private async ensureDepartmentSubscription(departmentId: string) {
    const freePlan = await this.getPlanByName('Free');

    return this.prisma.departmentSubscription.upsert({
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
  }

  private async resolveDepartmentContext(user: AuthUser, requestedDepartmentId?: string) {
    const userRecord = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: {
        id: true,
        tenantId: true,
        departmentId: true,
        tenant: {
          select: { id: true, name: true, domain: true, status: true },
        },
      },
    });

    if (!userRecord) {
      throw new ForbiddenException('User context is invalid');
    }

    const isPlatformAdmin = (user.roles ?? []).includes('PlatformAdmin');
    const targetDepartmentId = requestedDepartmentId ?? userRecord.departmentId;

    if (!targetDepartmentId) {
      throw new BadRequestException('No department is associated with this user');
    }

    if (!isPlatformAdmin && userRecord.departmentId !== targetDepartmentId) {
      throw new ForbiddenException('Department access denied');
    }

    const department = await this.prisma.department.findFirst({
      where: {
        id: targetDepartmentId,
        tenantId: userRecord.tenantId,
      },
      select: {
        id: true,
        tenantId: true,
        name: true,
        code: true,
        headOfDepartmentId: true,
      },
    });

    if (!department) {
      throw new DepartmentNotFoundException();
    }

    return {
      tenant: userRecord.tenant,
      department,
    };
  }
}
