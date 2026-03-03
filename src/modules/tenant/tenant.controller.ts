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
  Query,
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
import { BulkStudentInvitationsDto } from './dto/bulk-student-invitations.dto';
import { PreviewInvitationEmailDto } from './dto/preview-invitation-email.dto';
import { CreateInvitationMessageTemplateDto } from './dto/create-invitation-message-template.dto';
import { UpdateInvitationMessageTemplateDto } from './dto/update-invitation-message-template.dto';
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
  @Post('logo')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        logo: {
          type: 'string',
          format: 'binary',
        },
      },
      required: ['logo'],
    },
  })
  @ApiOperation({ summary: 'Upload/update institution logo (stored in tenant.config.branding)' })
  @ApiResponse({ status: 200, description: 'Institution logo updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file type or size' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @UseInterceptors(
    FileInterceptor('logo', {
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
      fileFilter: (req, file, cb) => {
        const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
        if (!allowed.has(file.mimetype)) {
          return cb(
            new BadRequestException('Invalid file type. Allowed: JPG, PNG, WEBP.'),
            false
          );
        }
        cb(null, true);
      },
    })
  )
  async uploadTenantLogo(@GetUser() user: any, @UploadedFile() logo: Express.Multer.File) {
    return this.tenantService.updateTenantLogo(user, logo);
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
  @Post('invitations/preview')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Preview invitation email (fallback HTML/text) with optional custom subject/message',
  })
  @ApiResponse({ status: 200, description: 'Invitation email preview generated successfully' })
  async previewInvitationEmail(@GetUser() user: any, @Body() dto: PreviewInvitationEmailDto) {
    return this.tenantService.previewInvitationEmail(user, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.DEPARTMENT_HEAD)
  @Post('invitations/message-templates')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a saved invitation message template/preset' })
  @ApiResponse({ status: 201, description: 'Invitation message template created successfully' })
  async createInvitationMessageTemplate(
    @GetUser() user: any,
    @Body() dto: CreateInvitationMessageTemplateDto
  ) {
    return this.tenantService.createInvitationMessageTemplate(user, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.DEPARTMENT_HEAD)
  @Get('invitations/message-templates')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List saved invitation message templates/presets for your department' })
  @ApiResponse({ status: 200, description: 'Invitation message templates retrieved successfully' })
  async listInvitationMessageTemplates(@GetUser() user: any) {
    return this.tenantService.listInvitationMessageTemplates(user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.DEPARTMENT_HEAD)
  @Patch('invitations/message-templates/:id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update an invitation message template/preset' })
  @ApiResponse({ status: 200, description: 'Invitation message template updated successfully' })
  async updateInvitationMessageTemplate(
    @GetUser() user: any,
    @Param('id') templateId: string,
    @Body() dto: UpdateInvitationMessageTemplateDto
  ) {
    return this.tenantService.updateInvitationMessageTemplate(user, templateId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.DEPARTMENT_HEAD)
  @Delete('invitations/message-templates/:id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete an invitation message template/preset' })
  @ApiResponse({ status: 200, description: 'Invitation message template deleted successfully' })
  async deleteInvitationMessageTemplate(
    @GetUser() user: any,
    @Param('id') templateId: string
  ) {
    return this.tenantService.deleteInvitationMessageTemplate(user, templateId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.DEPARTMENT_HEAD)
  @Post('invitations/bulk')
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Bulk invite students (max 50 per request)' })
  @ApiResponse({ status: 200, description: 'Bulk invitations processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async bulkInviteStudents(@GetUser() user: any, @Body() dto: BulkStudentInvitationsDto) {
    return this.tenantService.bulkInviteStudents(user, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.DEPARTMENT_HEAD)
  @Post('invitations/bulk/jobs')
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Enqueue bulk invite students job (async, max 50)' })
  @ApiResponse({ status: 202, description: 'Bulk invite job enqueued successfully' })
  async enqueueBulkInviteStudentsJob(
    @GetUser() user: any,
    @Body() dto: BulkStudentInvitationsDto
  ) {
    return this.tenantService.enqueueBulkInviteStudentsJob(user, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.DEPARTMENT_HEAD)
  @Get('invitations/bulk/jobs/:jobId')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get bulk invite job status/result (async)' })
  @ApiResponse({
    status: 200,
    description: 'Bulk invite job status retrieved successfully',
    schema: {
      example: {
        jobId: '123',
        state: 'completed',
        progress: { step: 'done', sent: 2, failures: 0 },
        createdAt: '2026-03-02T10:00:00.000Z',
        finishedAt: '2026-03-02T10:00:02.000Z',
        failedReason: undefined,
        result: {
          requested: 2,
          unique: 2,
          created: 2,
          skippedExisting: 0,
          duplicates: [],
          sendFailures: [],
          invitations: [
            {
              id: 'invitation-id',
              tenantId: 'tenant-id',
              departmentId: 'department-id',
              email: 'student1@uni.edu',
              roleName: 'STUDENT',
              status: 'PENDING',
              expiresAt: '2026-03-09T10:00:00.000Z',
              createdAt: '2026-03-02T10:00:00.000Z',
              acceptedAt: null,
              revokedAt: null,
              lastSentAt: '2026-03-02T10:00:01.000Z',
              sendCount: 1,
              lastSendError: null,
            },
          ],
        },
      },
    },
  })
  async getBulkInviteStudentsJobStatus(@GetUser() user: any, @Param('jobId') jobId: string) {
    return this.tenantService.getBulkInviteStudentsJobStatus(user, jobId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.DEPARTMENT_HEAD)
  @Get('invitations')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List invitations for your department' })
  @ApiResponse({ status: 200, description: 'Invitations retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async listInvitations(
    @GetUser() user: any,
    @Query('status') status?: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED'
  ) {
    return this.tenantService.listInvitations(user, { status });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.DEPARTMENT_HEAD)
  @Delete('invitations/:id')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Revoke an invitation (invalidate link)' })
  @ApiResponse({ status: 200, description: 'Invitation revoked successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  async revokeInvitation(@GetUser() user: any, @Param('id') invitationId: string) {
    return this.tenantService.revokeInvitation(user, invitationId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.DEPARTMENT_HEAD)
  @Post('invitations/:id/resend')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Resend invitation (new token, extended expiry)' })
  @ApiResponse({ status: 200, description: 'Invitation resent successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Invitation not found' })
  async resendInvitation(@GetUser() user: any, @Param('id') invitationId: string) {
    return this.tenantService.resendInvitation(user, invitationId);
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
