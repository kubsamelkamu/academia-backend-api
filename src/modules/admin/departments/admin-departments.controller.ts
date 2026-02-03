import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { ROLES } from '../../../common/constants/roles.constants';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../../common/guards/roles.guard';

import { AdminDepartmentsService } from './admin-departments.service';
import { AdminCreateDepartmentDto } from './dto/admin-create-department.dto';
import { AdminListDepartmentsQueryDto } from './dto/admin-list-departments.query';
import { AdminSetDepartmentHeadDto } from './dto/admin-set-department-head.dto';
import { AdminSetDepartmentHeadByEmailDto } from './dto/admin-set-department-head-by-email.dto';
import { JwtAuthGuard } from '@app/modules/auth/guards/jwt-auth.guard';

@ApiTags('Admin Departments')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.PLATFORM_ADMIN)
@Controller({ path: 'admin/tenants/:tenantId/departments', version: '1' })
export class AdminDepartmentsController {
  constructor(private readonly departments: AdminDepartmentsService) {}

  @Get()
  @ApiOperation({ summary: 'List departments for a tenant' })
  @ApiNotFoundResponse({ description: 'Tenant not found' })
  async list(@Param('tenantId') tenantId: string, @Query() query: AdminListDepartmentsQueryDto) {
    return this.departments.listForTenant(tenantId, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create a department for a tenant' })
  @ApiBadRequestResponse({
    description: 'Invalid payload, duplicate department code, or invalid headOfDepartmentId tenant',
  })
  @ApiNotFoundResponse({
    description: 'Tenant not found or headOfDepartment user not found',
  })
  async create(@Param('tenantId') tenantId: string, @Body() dto: AdminCreateDepartmentDto) {
    return this.departments.createForTenant(tenantId, dto);
  }

  @Patch(':departmentId/head')
  @ApiOperation({ summary: 'Assign or remove the head of a department' })
  @ApiBadRequestResponse({
    description: 'Invalid payload or headOfDepartmentId belongs to a different tenant',
  })
  @ApiNotFoundResponse({
    description: 'Tenant not found, department not found, or user not found',
  })
  async setHead(
    @Param('tenantId') tenantId: string,
    @Param('departmentId') departmentId: string,
    @Body() dto: AdminSetDepartmentHeadDto
  ) {
    return this.departments.setDepartmentHead(tenantId, departmentId, dto);
  }

  @Patch(':departmentId/head/by-email')
  @ApiOperation({ summary: 'Assign department head by email (invites if not found)' })
  @ApiBadRequestResponse({
    description: 'Invalid payload or the user belongs to a different tenant',
  })
  @ApiNotFoundResponse({ description: 'Tenant not found or department not found' })
  async setHeadByEmail(
    @Param('tenantId') tenantId: string,
    @Param('departmentId') departmentId: string,
    @Body() dto: AdminSetDepartmentHeadByEmailDto
  ) {
    return this.departments.setDepartmentHeadByEmail(tenantId, departmentId, dto);
  }
}
