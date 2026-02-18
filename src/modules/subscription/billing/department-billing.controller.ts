import { Body, Controller, Get, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ROLES } from '../../../common/constants/roles.constants';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { GetUser } from '../../auth/decorators/get-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { BillingActionDto } from './dto/billing-action.dto';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { SchedulePlanChangeDto } from './dto/schedule-plan-change.dto';
import { DepartmentBillingService } from './department-billing.service';

@ApiTags('Department Billing')
@Controller({ path: 'billing/department', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('access-token')
@Roles(ROLES.DEPARTMENT_HEAD, ROLES.PLATFORM_ADMIN)
export class DepartmentBillingController {
  constructor(private readonly billingService: DepartmentBillingService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Get current department billing summary' })
  @ApiResponse({ status: 200, description: 'Billing summary retrieved' })
  async getSummary(@GetUser() user: any, @Query() query: BillingActionDto) {
    return this.billingService.getSummary(user, query.departmentId);
  }

  @Get('usage')
  @ApiOperation({ summary: 'Get department usage snapshot' })
  @ApiResponse({ status: 200, description: 'Usage snapshot retrieved' })
  async getUsage(@GetUser() user: any, @Query() query: BillingActionDto) {
    return this.billingService.getUsage(user, query.departmentId);
  }

  @Post('checkout')
  @ApiOperation({ summary: 'Create Paddle checkout session for Pro plan' })
  @ApiResponse({ status: 200, description: 'Checkout session created' })
  async createCheckout(@GetUser() user: any, @Body() dto: CreateCheckoutSessionDto) {
    return this.billingService.createCheckoutSession(
      user,
      dto.planName,
      dto.departmentId,
      dto.returnUrl
    );
  }

  @Patch('change-plan')
  @ApiOperation({ summary: 'Schedule plan change using period-end policy' })
  @ApiResponse({ status: 200, description: 'Plan change processed' })
  async schedulePlanChange(@GetUser() user: any, @Body() dto: SchedulePlanChangeDto) {
    return this.billingService.schedulePlanChange(user, dto.planName, dto.departmentId);
  }

  @Patch('cancel')
  @ApiOperation({ summary: 'Cancel current paid subscription at period end' })
  @ApiResponse({ status: 200, description: 'Cancellation scheduled' })
  async cancel(@GetUser() user: any, @Body() dto: BillingActionDto) {
    return this.billingService.cancelAtPeriodEnd(user, dto.departmentId);
  }

  @Patch('reactivate')
  @ApiOperation({ summary: 'Remove scheduled cancellation for active subscription' })
  @ApiResponse({ status: 200, description: 'Subscription reactivated' })
  async reactivate(@GetUser() user: any, @Body() dto: BillingActionDto) {
    return this.billingService.reactivate(user, dto.departmentId);
  }

  @Post('portal')
  @ApiOperation({ summary: 'Create Paddle customer portal session' })
  @ApiResponse({ status: 200, description: 'Customer portal session created' })
  async createPortalSession(@GetUser() user: any, @Body() dto: BillingActionDto) {
    return this.billingService.createCustomerPortalSession(user, dto.departmentId);
  }
}
