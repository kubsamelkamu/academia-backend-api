import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ROLES } from '../../common/constants/roles.constants';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { TenantService } from './tenant.service';
import { UpdateTenantConfigDto } from './dto/update-tenant-config.dto';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto';
import { CreateAcademicYearDto, UpdateAcademicYearDto } from './dto/academic-year.dto';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';
import { UpdateTenantAddressDto } from './dto/update-tenant-address.dto';

@ApiTags('Tenant')
@Controller({ path: 'tenant', version: '1' })
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.DEPARTMENT_HEAD, ROLES.PLATFORM_ADMIN)
  @Get('current')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get current institution details' })
  @ApiResponse({ status: 200, description: 'Tenant details retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getCurrentTenant(@GetUser() user: any) {
    return this.tenantService.getCurrentTenant(user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.DEPARTMENT_HEAD, ROLES.PLATFORM_ADMIN)
  @Put('config')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update institution configuration' })
  @ApiResponse({ status: 200, description: 'Configuration updated successfully' })
  @ApiResponse({
    status: 429,
    description: 'Too Many Requests (rate limited)',
    schema: {
      example: {
        success: false,
        message: 'ThrottlerException: Too Many Requests',
        error: { code: 'THROTTLER' },
        timestamp: '2026-02-05T09:06:04.194Z',
        path: '/api/v1/tenant/config',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid configuration' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async updateTenantConfig(@GetUser() user: any, @Body() dto: UpdateTenantConfigDto) {
    return this.tenantService.updateTenantConfig(user, dto.config);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.DEPARTMENT_HEAD, ROLES.PLATFORM_ADMIN)
  @Patch('address')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Update institution address/contact details (stored in tenant.config.address)',
  })
  @ApiResponse({ status: 200, description: 'Institution address updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async updateTenantAddress(@GetUser() user: any, @Body() dto: UpdateTenantAddressDto) {
    return this.tenantService.updateTenantAddress(user, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.DEPARTMENT_HEAD, ROLES.PLATFORM_ADMIN)
  @Get('departments')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List all departments in the tenant' })
  @ApiResponse({ status: 200, description: 'Departments retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getDepartments(@GetUser() user: any) {
    return this.tenantService.getDepartments(user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.DEPARTMENT_HEAD, ROLES.PLATFORM_ADMIN)
  @Post('departments')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create new department' })
  @ApiResponse({ status: 201, description: 'Department created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid department data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async createDepartment(@GetUser() user: any, @Body() dto: CreateDepartmentDto) {
    return this.tenantService.createDepartment(user, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.DEPARTMENT_HEAD, ROLES.PLATFORM_ADMIN)
  @Put('departments/:id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update department' })
  @ApiResponse({ status: 200, description: 'Department updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid department data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Department not found' })
  async updateDepartment(
    @GetUser() user: any,
    @Param('id') departmentId: string,
    @Body() dto: UpdateDepartmentDto
  ) {
    return this.tenantService.updateDepartment(user, departmentId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.DEPARTMENT_HEAD, ROLES.PLATFORM_ADMIN)
  @Get('academic-years')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List all academic years in the tenant' })
  @ApiResponse({ status: 200, description: 'Academic years retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getAcademicYears(@GetUser() user: any) {
    return this.tenantService.getAcademicYears(user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.DEPARTMENT_HEAD, ROLES.PLATFORM_ADMIN)
  @Post('academic-years')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create new academic year' })
  @ApiResponse({ status: 201, description: 'Academic year created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid academic year data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async createAcademicYear(@GetUser() user: any, @Body() dto: CreateAcademicYearDto) {
    const data = {
      ...dto,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
    };
    return this.tenantService.createAcademicYear(user, data);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.DEPARTMENT_HEAD, ROLES.PLATFORM_ADMIN)
  @Put('academic-years/:id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update academic year' })
  @ApiResponse({ status: 200, description: 'Academic year updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid academic year data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Academic year not found' })
  async updateAcademicYear(
    @GetUser() user: any,
    @Param('id') academicYearId: string,
    @Body() dto: UpdateAcademicYearDto
  ) {
    const data: any = { ...dto };
    if (dto.startDate) data.startDate = new Date(dto.startDate);
    if (dto.endDate) data.endDate = new Date(dto.endDate);
    return this.tenantService.updateAcademicYear(user, academicYearId, data);
  }

  // ====================
  // USER MANAGEMENT
  // ====================

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.DEPARTMENT_HEAD)
  @Get('users')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get all users in department' })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async getDepartmentUsers(@GetUser() user: any) {
    return this.tenantService.getDepartmentUsers(user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.DEPARTMENT_HEAD)
  @Get('users/:id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get user details by ID' })
  @ApiResponse({ status: 200, description: 'User details retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserById(@GetUser() user: any, @Param('id') userId: string) {
    return this.tenantService.getUserById(user, userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.DEPARTMENT_HEAD)
  @Post('users')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create new user in department' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 409, description: 'User with this email already exists' })
  async createUser(@GetUser() user: any, @Body() dto: CreateUserDto) {
    return this.tenantService.createUser(user, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.DEPARTMENT_HEAD)
  @Post('invitations')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Invite a user to join your department' })
  @ApiResponse({ status: 201, description: 'Invitation created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 409, description: 'User with this email already exists' })
  async createInvitation(@GetUser() user: any, @Body() dto: CreateInvitationDto) {
    return this.tenantService.createInvitation(user, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.DEPARTMENT_HEAD)
  @Put('users/:id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update user details' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 409, description: 'User with this email already exists' })
  async updateUser(@GetUser() user: any, @Param('id') userId: string, @Body() dto: UpdateUserDto) {
    return this.tenantService.updateUser(user, userId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.DEPARTMENT_HEAD)
  @Delete('users/:id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Deactivate user' })
  @ApiResponse({ status: 200, description: 'User deactivated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async deactivateUser(@GetUser() user: any, @Param('id') userId: string) {
    return this.tenantService.deactivateUser(user, userId);
  }

  // ====================
  // TENANT VERIFICATION
  // ====================

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.DEPARTMENT_HEAD)
  @Post('verification/document')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('access-token')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        document: {
          type: 'string',
          format: 'binary',
        },
      },
      required: ['document'],
    },
  })
  @ApiOperation({ summary: 'Submit institution verification document (Department Head)' })
  @ApiResponse({ status: 201, description: 'Verification document submitted successfully' })
  @ApiResponse({ status: 400, description: 'Invalid document or email not verified' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @UseInterceptors(
    FileInterceptor('document', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
      fileFilter: (req, file, cb) => {
        const allowed = new Set(['application/pdf', 'image/jpeg', 'image/png']);
        if (!allowed.has(file.mimetype)) {
          return cb(new BadRequestException('Invalid file type. Allowed: PDF, JPG, PNG.'), false);
        }
        cb(null, true);
      },
    })
  )
  async submitVerificationDocument(
    @GetUser() user: any,
    @UploadedFile() document: Express.Multer.File
  ) {
    return this.tenantService.submitVerificationDocument(user, document);
  }
}
