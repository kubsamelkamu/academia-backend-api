import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ROLES } from '../../../common/constants/roles.constants';
import { GetUser } from '../../auth/decorators/get-user.decorator';
import { AdminTenantsService } from './admin-tenants.service';
import { AdminCreateTenantDto } from './dto/admin-create-tenant.dto';
import { AdminUpdateTenantDto } from './dto/admin-update-tenant.dto';
import { AdminUpdateTenantStatusDto } from './dto/admin-update-tenant-status.dto';
import { AdminListTenantsQueryDto } from './dto/admin-list-tenants.query';

@ApiTags('Admin Tenants')
@Controller({ path: 'admin/tenants', version: '1' })
export class AdminTenantsController {
  constructor(private readonly tenantsService: AdminTenantsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.PLATFORM_ADMIN)
  @Get()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List tenants (universities)' })
  @ApiResponse({ status: 200, description: 'Tenants retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async list(@GetUser() user: any, @Query() query: AdminListTenantsQueryDto) {
    return this.tenantsService.listTenants({
      user,
      page: query.page,
      limit: query.limit,
      search: query.search,
      status: query.status,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.PLATFORM_ADMIN)
  @Post()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create tenant (university)' })
  @ApiResponse({ status: 201, description: 'Tenant created' })
  @ApiResponse({ status: 400, description: 'Validation failed or domain already exists' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async create(@GetUser() user: any, @Body() dto: AdminCreateTenantDto) {
    return this.tenantsService.createTenant(user, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.PLATFORM_ADMIN)
  @Get(':tenantId')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get tenant by id' })
  @ApiResponse({ status: 200, description: 'Tenant retrieved' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getById(@GetUser() user: any, @Param('tenantId') tenantId: string) {
    return this.tenantsService.getTenantById(user, tenantId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.PLATFORM_ADMIN)
  @Patch(':tenantId')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update tenant' })
  @ApiResponse({ status: 200, description: 'Tenant updated' })
  @ApiResponse({ status: 400, description: 'Validation failed or domain already exists' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async update(
    @GetUser() user: any,
    @Param('tenantId') tenantId: string,
    @Body() dto: AdminUpdateTenantDto
  ) {
    return this.tenantsService.updateTenant(user, tenantId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.PLATFORM_ADMIN)
  @Patch(':tenantId/status')
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update tenant status' })
  @ApiResponse({ status: 200, description: 'Tenant status updated' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async updateStatus(
    @GetUser() user: any,
    @Param('tenantId') tenantId: string,
    @Body() dto: AdminUpdateTenantStatusDto
  ) {
    return this.tenantsService.updateTenantStatus(user, tenantId, dto.status);
  }
}
