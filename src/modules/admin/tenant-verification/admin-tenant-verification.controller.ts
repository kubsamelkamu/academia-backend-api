import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ROLES } from '../../../common/constants/roles.constants';
import { GetUser } from '../../auth/decorators/get-user.decorator';
import { AdminTenantVerificationService } from './admin-tenant-verification.service';
import { AdminListTenantVerificationRequestsQueryDto } from './dto/admin-list-tenant-verification-requests.query';
import {
  AdminApproveTenantVerificationDto,
  AdminRejectTenantVerificationDto,
} from './dto/admin-review-tenant-verification.dto';

@ApiTags('Admin Tenant Verification')
@Controller({ path: 'admin/tenant-verification', version: '1' })
export class AdminTenantVerificationController {
  constructor(private readonly verificationService: AdminTenantVerificationService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.PLATFORM_ADMIN)
  @Get('requests')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List tenant verification requests (default: PENDING)' })
  @ApiResponse({ status: 200, description: 'Verification requests retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async list(@GetUser() user: any, @Query() query: AdminListTenantVerificationRequestsQueryDto) {
    return this.verificationService.listRequests({
      user,
      page: query.page,
      limit: query.limit,
      status: query.status,
      tenantId: query.tenantId,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.PLATFORM_ADMIN)
  @Get('requests/:requestId')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get verification request by id' })
  @ApiResponse({ status: 200, description: 'Verification request retrieved' })
  @ApiResponse({ status: 404, description: 'Verification request not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getById(@GetUser() user: any, @Param('requestId') requestId: string) {
    return this.verificationService.getRequestById(user, requestId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.PLATFORM_ADMIN)
  @Post('requests/:requestId/approve')
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a PENDING verification request' })
  @ApiResponse({ status: 200, description: 'Verification request approved' })
  @ApiResponse({ status: 409, description: 'Verification request already reviewed' })
  @ApiResponse({ status: 404, description: 'Verification request not found' })
  async approve(
    @GetUser() user: any,
    @Param('requestId') requestId: string,
    @Body() dto: AdminApproveTenantVerificationDto
  ) {
    return this.verificationService.approveRequest(user, requestId, dto.reason);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.PLATFORM_ADMIN)
  @Post('requests/:requestId/reject')
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a PENDING verification request' })
  @ApiResponse({ status: 200, description: 'Verification request rejected' })
  @ApiResponse({ status: 409, description: 'Verification request already reviewed' })
  @ApiResponse({ status: 404, description: 'Verification request not found' })
  async reject(
    @GetUser() user: any,
    @Param('requestId') requestId: string,
    @Body() dto: AdminRejectTenantVerificationDto
  ) {
    return this.verificationService.rejectRequest(user, requestId, dto.reason);
  }
}
