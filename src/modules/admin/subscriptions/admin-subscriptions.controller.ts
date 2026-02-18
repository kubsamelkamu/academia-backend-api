import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { ROLES } from '../../../common/constants/roles.constants';
import { Roles } from '../../../common/decorators/roles.decorator';
import { GetUser } from '../../auth/decorators/get-user.decorator';
import { AdminSubscriptionsService } from './admin-subscriptions.service';
import { AdminOverrideDepartmentSubscriptionDto } from './dto/admin-override-department-subscription.dto';
import { AdminListSubscriptionPlansQueryDto } from './dto/admin-list-subscription-plans.query';
import { AdminRetryWebhookDto } from './dto/admin-retry-webhook.dto';
import { AdminSetDepartmentPlanDto } from './dto/admin-set-department-plan.dto';
import { AdminSetTenantPlanDto } from './dto/admin-set-tenant-plan.dto';

@ApiTags('Admin Subscriptions')
@Controller({ path: 'admin/subscriptions', version: '1' })
export class AdminSubscriptionsController {
  constructor(private readonly subscriptionsService: AdminSubscriptionsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.PLATFORM_ADMIN)
  @Get('plans')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List subscription plans' })
  @ApiResponse({
    status: 200,
    description: 'Plans retrieved',
    schema: {
      example: {
        data: [
          {
            id: '6c0b4f6e-9b61-4c01-b4d1-6f0cab9e1a18',
            name: 'Free',
            description: 'Free plan for small institutions',
            features: {
              maxUsers: 100,
              maxDepartments: 1,
              storageGB: 5,
              customRubrics: false,
              bulkImport: false,
              apiAccess: false,
              prioritySupport: false,
            },
            price: '0',
            billingCycle: 'monthly',
            isActive: true,
            createdAt: '2026-01-31T00:00:00.000Z',
            updatedAt: '2026-01-31T00:00:00.000Z',
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 500, description: 'Failed to list subscription plans' })
  async listPlans(@Query() query: AdminListSubscriptionPlansQueryDto) {
    return this.subscriptionsService.listPlans({ includeInactive: query.includeInactive });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.PLATFORM_ADMIN)
  @Get('/tenants/:tenantId')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get tenant subscription (ensures Free row exists)' })
  @ApiResponse({ status: 200, description: 'Tenant subscription retrieved' })
  @ApiResponse({ status: 404, description: 'Tenant not found or Free plan not configured' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getTenantSubscription(@Param('tenantId') tenantId: string) {
    return this.subscriptionsService.getTenantSubscription(tenantId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.PLATFORM_ADMIN)
  @Patch('/tenants/:tenantId/downgrade')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Downgrade Pro → Free at period end (cancelAtPeriodEnd=true)' })
  @ApiResponse({ status: 200, description: 'Downgrade scheduled (end of current period)' })
  @ApiResponse({ status: 400, description: 'Tenant is not on Pro' })
  @ApiResponse({ status: 404, description: 'Tenant not found or subscription not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async downgradeAtPeriodEnd(@Param('tenantId') tenantId: string) {
    return this.subscriptionsService.downgradeTenantAtPeriodEnd(tenantId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.PLATFORM_ADMIN)
  @Patch('/tenants/:tenantId/plan')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Set tenant plan (local DB only, for testing)' })
  @ApiResponse({ status: 200, description: 'Tenant subscription updated' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 404, description: 'Tenant not found or plan not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async setTenantPlan(@Param('tenantId') tenantId: string, @Body() dto: AdminSetTenantPlanDto) {
    return this.subscriptionsService.setTenantPlanLocal(tenantId, dto.planName);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.PLATFORM_ADMIN)
  @Get('/tenants/:tenantId/departments/:departmentId')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get department subscription (ensures Free row exists)' })
  @ApiResponse({ status: 200, description: 'Department subscription retrieved' })
  @ApiResponse({ status: 404, description: 'Tenant/Department not found or Free plan not configured' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getDepartmentSubscription(
    @Param('tenantId') tenantId: string,
    @Param('departmentId') departmentId: string
  ) {
    return this.subscriptionsService.getDepartmentSubscription(tenantId, departmentId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.PLATFORM_ADMIN)
  @Patch('/tenants/:tenantId/departments/:departmentId/downgrade')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Downgrade department Pro → Free at period end (cancelAtPeriodEnd=true)' })
  @ApiResponse({ status: 200, description: 'Downgrade scheduled (end of current period)' })
  @ApiResponse({ status: 400, description: 'Department is not on Pro' })
  @ApiResponse({ status: 404, description: 'Tenant/Department not found or subscription not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async downgradeDepartmentAtPeriodEnd(
    @Param('tenantId') tenantId: string,
    @Param('departmentId') departmentId: string
  ) {
    return this.subscriptionsService.downgradeDepartmentAtPeriodEnd(tenantId, departmentId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.PLATFORM_ADMIN)
  @Patch('/tenants/:tenantId/departments/:departmentId/plan')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Set department plan (local DB only, for testing)' })
  @ApiResponse({ status: 200, description: 'Department subscription updated' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 404, description: 'Tenant/Department not found or plan not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async setDepartmentPlan(
    @Param('tenantId') tenantId: string,
    @Param('departmentId') departmentId: string,
    @Body() dto: AdminSetDepartmentPlanDto
  ) {
    return this.subscriptionsService.setDepartmentPlanLocal(tenantId, departmentId, dto.planName);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.PLATFORM_ADMIN)
  @Patch('/tenants/:tenantId/departments/:departmentId/override')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Admin override department subscription (with audit)' })
  @ApiResponse({ status: 200, description: 'Department subscription overridden' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 404, description: 'Tenant/Department not found or plan missing' })
  async overrideDepartmentSubscription(
    @Param('tenantId') tenantId: string,
    @Param('departmentId') departmentId: string,
    @GetUser('sub') actorUserId: string,
    @Body() dto: AdminOverrideDepartmentSubscriptionDto
  ) {
    return this.subscriptionsService.overrideDepartmentSubscription(
      tenantId,
      departmentId,
      actorUserId,
      dto
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.PLATFORM_ADMIN)
  @Post('/webhooks/events/:providerEventId/retry')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Retry processing a stored Paddle webhook event (with audit)' })
  @ApiResponse({ status: 200, description: 'Webhook event retried' })
  @ApiResponse({ status: 404, description: 'Webhook event not found' })
  async retryWebhookEvent(
    @Param('providerEventId') providerEventId: string,
    @GetUser('sub') actorUserId: string,
    @Body() dto: AdminRetryWebhookDto
  ) {
    return this.subscriptionsService.retryWebhookEvent(providerEventId, actorUserId, dto.reason);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.PLATFORM_ADMIN)
  @Get('/audit')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List billing admin audit logs' })
  @ApiResponse({ status: 200, description: 'Audit logs retrieved' })
  async listAudit(@Query('limit') limit?: string) {
    return this.subscriptionsService.listBillingAudit(limit ? Number(limit) : undefined);
  }
}
