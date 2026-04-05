import {
  Controller,
  Delete,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProjectService } from './project.service';
import {
  CreateProposalDto,
  CreateProposalFeedbackDto,
  CreateMilestoneSubmissionFeedbackDto,
  ListProposalsDto,
  UpdateProposalStatusDto,
  ListProjectsDto,
  CreateProjectDto,
  AssignAdvisorDto,
  UpdateMilestoneStatusDto,
  ListAdvisorsDto,
  CheckAdvisorAvailabilityDto,
  SetAdvisorLoadLimitDto,
  AddProjectMemberDto,
  CreateProposalRejectionReminderDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { ROLES } from '../../common/constants/roles.constants';

@ApiTags('Project Management')
@Controller({ path: 'projects', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('access-token')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  // Advisor endpoints (must be declared before any ':id' routes)
  @Get('advisors')
  @ApiOperation({ summary: 'List advisors in department' })
  @ApiResponse({ status: 200, description: 'Advisors retrieved successfully' })
  async getAdvisors(@Query() filters: ListAdvisorsDto, @GetUser() user: any) {
    if (!filters.departmentId) {
      throw new BadRequestException('departmentId is required');
    }
    const includeLoad = filters.includeLoad === 'true';
    return this.projectService.getAdvisors(filters.departmentId, includeLoad, user);
  }

  @Get('advisors/:id/workload')
  @ApiOperation({ summary: 'Get advisor workload details' })
  @ApiResponse({ status: 200, description: 'Workload retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Advisor not found' })
  async getAdvisorWorkload(@Param('id') advisorId: string, @GetUser() user: any) {
    return this.projectService.getAdvisorWorkload(advisorId, user);
  }

  @Get('advisors/me/summary')
  @Roles(ROLES.ADVISOR)
  @ApiOperation({ summary: 'Get my advisor summary (advisor dashboard)' })
  @ApiResponse({ status: 200, description: 'Advisor summary retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Advisor profile not found' })
  async getMyAdvisorSummary(@GetUser() user: any) {
    return this.projectService.getMyAdvisorSummary(user);
  }

  @Get('advisors/:id/summary')
  @ApiOperation({ summary: 'Get advisor summary with advised groups, projects, and student totals' })
  @ApiResponse({ status: 200, description: 'Advisor summary retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Advisor not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async getAdvisorSummary(@Param('id') advisorId: string, @GetUser() user: any) {
    return this.projectService.getAdvisorSummary(advisorId, user);
  }

  @Get('advisors/me/projects')
  @Roles(ROLES.ADVISOR)
  @ApiOperation({
    summary: 'List my assigned projects with group info and milestone progress (advisor dashboard)',
  })
  @ApiResponse({ status: 200, description: 'Advisor projects retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Advisor profile not found' })
  async listMyAdvisorProjects(@GetUser() user: any) {
    return this.projectService.listMyAdvisorProjects(user);
  }

  @Get('advisors/me/milestone-review-queue')
  @Roles(ROLES.ADVISOR)
  @ApiOperation({
    summary: 'List currently submitted milestones waiting for my review as assigned advisor',
  })
  @ApiResponse({ status: 200, description: 'Advisor milestone review queue retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Advisor profile not found' })
  async listMyAdvisorMilestoneReviewQueue(@GetUser() user: any) {
    return this.projectService.listMyAdvisorMilestoneReviewQueue(user);
  }

  @Get('advisors/:id/projects')
  @ApiOperation({
    summary:
      'List projects assigned to an advisor with group info and milestone progress (advisor self or department staff)',
  })
  @ApiResponse({ status: 200, description: 'Advisor projects retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Advisor not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async listAdvisorProjects(@Param('id') advisorId: string, @GetUser() user: any) {
    return this.projectService.listAdvisorProjects(advisorId, user);
  }

  @Get('advisors/:id/milestone-review-queue')
  @ApiOperation({
    summary:
      'List currently submitted milestones waiting for review for an advisor (advisor self or department staff)',
  })
  @ApiResponse({ status: 200, description: 'Advisor milestone review queue retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Advisor not found' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async listAdvisorMilestoneReviewQueue(@Param('id') advisorId: string, @GetUser() user: any) {
    return this.projectService.listAdvisorMilestoneReviewQueue(advisorId, user);
  }

  @Get('advisors/availability')
  @ApiOperation({ summary: 'Check advisor availability for assignment' })
  @ApiResponse({ status: 200, description: 'Available advisors retrieved' })
  async checkAdvisorAvailability(
    @Query() filters: CheckAdvisorAvailabilityDto,
    @GetUser() user: any
  ) {
    return this.projectService.checkAdvisorAvailability(
      filters.departmentId,
      filters.minCapacity || 1,
      user
    );
  }

  @Put('advisors/:id/load-limit')
  @Roles(ROLES.DEPARTMENT_HEAD)
  @ApiOperation({ summary: 'Set advisor load limit' })
  @ApiResponse({ status: 200, description: 'Load limit updated successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async setAdvisorLoadLimit(
    @Param('id') advisorId: string,
    @Body() updateData: SetAdvisorLoadLimitDto,
    @GetUser() user: any
  ) {
    return this.projectService.setAdvisorLoadLimit(advisorId, updateData.loadLimit, user);
  }

  // Proposal endpoints
  @Post('proposals')
  @Roles(ROLES.STUDENT)
  @ApiOperation({ summary: 'Create proposal draft (approved group leaders only)' })
  @ApiResponse({ status: 201, description: 'Proposal draft created' })
  async createProposal(@Body() dto: CreateProposalDto, @GetUser() user: any) {
    return this.projectService.createProposalDraft(dto, user);
  }

  @Post('proposals/with-proposal-pdf')
  @Roles(ROLES.STUDENT)
  @HttpCode(HttpStatus.CREATED)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        titles: {
          oneOf: [
            { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 3 },
            {
              type: 'string',
              description: 'Either repeat titles 3 times or pass JSON array string',
            },
          ],
        },
        description: { type: 'string' },
        proposalPdf: { type: 'string', format: 'binary' },
      },
      required: ['titles', 'proposalPdf'],
    },
  })
  @ApiOperation({
    summary:
      'Create proposal draft and upload proposal PDF in one request (PDF-only, max 5MB) (approved group leaders only)',
  })
  @ApiResponse({ status: 201, description: 'Proposal draft created with proposal PDF' })
  @UseInterceptors(
    FileInterceptor('proposalPdf', {
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
      fileFilter: (req, file, cb) => {
        if (file.mimetype !== 'application/pdf') {
          return cb(new BadRequestException('Invalid file type. Allowed: PDF.'), false);
        }
        cb(null, true);
      },
    })
  )
  async createProposalWithPdf(
    @Body() body: any,
    @GetUser() user: any,
    @UploadedFile() proposalPdf: Express.Multer.File
  ) {
    return this.projectService.createProposalDraftWithPdf(
      {
        titles: body?.titles,
        description: body?.description,
      },
      proposalPdf,
      user
    );
  }

  @Post('proposals/:id/submit')
  @Roles(ROLES.STUDENT)
  @ApiOperation({ summary: 'Submit proposal for review (approved group leaders only)' })
  @ApiResponse({ status: 200, description: 'Proposal submitted successfully' })
  async submitProposal(@Param('id') id: string, @GetUser() user: any) {
    return this.projectService.submitProposal(id, user);
  }

  @Post('proposals/:id/proposal-pdf')
  @Roles(ROLES.STUDENT)
  @HttpCode(HttpStatus.CREATED)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        proposalPdf: { type: 'string', format: 'binary' },
      },
      required: ['proposalPdf'],
    },
  })
  @ApiOperation({
    summary: 'Upload proposal PDF (PDF-only, max 5MB) (approved group leaders only)',
  })
  @ApiResponse({ status: 201, description: 'Proposal PDF uploaded successfully' })
  @UseInterceptors(
    FileInterceptor('proposalPdf', {
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
      fileFilter: (req, file, cb) => {
        if (file.mimetype !== 'application/pdf') {
          return cb(new BadRequestException('Invalid file type. Allowed: PDF.'), false);
        }
        cb(null, true);
      },
    })
  )
  async uploadProposalPdf(
    @Param('id') id: string,
    @GetUser() user: any,
    @UploadedFile() proposalPdf: Express.Multer.File
  ) {
    return this.projectService.uploadProposalPdf(id, proposalPdf, user);
  }

  @Get('proposals/group')
  @Roles(ROLES.STUDENT)
  @ApiOperation({ summary: 'List proposals for my approved project group (all group members)' })
  @ApiResponse({ status: 200, description: 'Group proposals retrieved successfully' })
  async listGroupProposals(@GetUser() user: any) {
    return this.projectService.listGroupProposals(user);
  }

  @Get('proposals')
  @ApiOperation({ summary: 'List proposals in department' })
  @ApiResponse({ status: 200, description: 'Proposals retrieved successfully' })
  async getProposals(
    @Query() filters: ListProposalsDto,
    @Query('departmentId') departmentId: string,
    @GetUser() user: any
  ) {
    return this.projectService.getProposals(departmentId, filters, user);
  }

  @Post('proposals/:id/rejection-reminder')
  @Roles(ROLES.DEPARTMENT_HEAD, ROLES.COORDINATOR)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a rejected proposal resubmission reminder for the proposal group',
  })
  @ApiResponse({ status: 201, description: 'Proposal rejection reminder created successfully' })
  @ApiResponse({ status: 400, description: 'Proposal is invalid for reminder creation' })
  @ApiResponse({ status: 409, description: 'An active reminder already exists' })
  async createProposalRejectionReminder(
    @Param('id') id: string,
    @Body() dto: CreateProposalRejectionReminderDto,
    @GetUser() user: any
  ) {
    return this.projectService.createProposalRejectionReminder(id, dto, user);
  }

  @Get('proposals/:id')
  @ApiOperation({ summary: 'Get proposal details' })
  @ApiResponse({ status: 200, description: 'Proposal details retrieved' })
  @ApiResponse({ status: 404, description: 'Proposal not found' })
  async getProposalById(@Param('id') id: string, @GetUser() user: any) {
    return this.projectService.getProposalById(id, user);
  }

  @Post('proposals/:id/feedbacks')
  @Roles(ROLES.ADVISOR, ROLES.DEPARTMENT_HEAD, ROLES.COORDINATOR)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add feedback comment to a submitted proposal' })
  @ApiResponse({ status: 201, description: 'Proposal feedback created' })
  @ApiResponse({ status: 409, description: 'Proposal is not in SUBMITTED state' })
  async addProposalFeedback(
    @Param('id') id: string,
    @Body() dto: CreateProposalFeedbackDto,
    @GetUser() user: any
  ) {
    return this.projectService.addProposalFeedback(id, dto, user);
  }

  @Get('proposals/:id/feedbacks')
  @ApiOperation({ summary: 'List feedback comments for a proposal' })
  @ApiResponse({ status: 200, description: 'Proposal feedback retrieved' })
  async listProposalFeedbacks(@Param('id') id: string, @GetUser() user: any) {
    return this.projectService.listProposalFeedbacks(id, user);
  }

  @Put('proposals/:id/status')
  @Roles(ROLES.DEPARTMENT_HEAD, ROLES.COORDINATOR)
  @ApiOperation({ summary: 'Update proposal status' })
  @ApiResponse({ status: 200, description: 'Proposal status updated' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async updateProposalStatus(
    @Param('id') id: string,
    @Body() updateData: UpdateProposalStatusDto,
    @GetUser() user: any
  ) {
    return this.projectService.updateProposalStatus(id, updateData, user);
  }

  @Put('proposals/:id/advisor')
  @Roles(ROLES.DEPARTMENT_HEAD, ROLES.COORDINATOR)
  @ApiOperation({ summary: 'Assign advisor to an already approved proposal' })
  @ApiResponse({ status: 200, description: 'Proposal advisor assigned successfully' })
  @ApiResponse({ status: 400, description: 'Proposal is not eligible for advisor assignment' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Proposal or advisor not found' })
  async assignProposalAdvisor(
    @Param('id') id: string,
    @Body() assignData: AssignAdvisorDto,
    @GetUser() user: any
  ) {
    return this.projectService.assignProposalAdvisor(id, assignData, user);
  }

  // Project endpoints
  @Get()
  @ApiOperation({ summary: 'List projects in department' })
  @ApiResponse({ status: 200, description: 'Projects retrieved successfully' })
  async getProjects(
    @Query() filters: ListProjectsDto,
    @Query('departmentId') departmentId: string,
    @GetUser() user: any
  ) {
    return this.projectService.getProjects(departmentId, filters, user);
  }

  @Post()
  @Roles(ROLES.DEPARTMENT_HEAD, ROLES.COORDINATOR, ROLES.ADVISOR)
  @ApiOperation({ summary: 'Create project from approved proposal' })
  @ApiResponse({
    status: 201,
    description: 'Project created successfully',
    schema: {
      example: {
        id: 'project-id',
        tenantId: 'tenant-id',
        departmentId: 'department-id',
        title: 'Smart Campus Navigation',
        description: 'Project summary...',
        status: 'ACTIVE',
        proposalId: 'proposal-id',
        advisorId: 'advisor-user-id',
        milestoneTemplateId: null,
        createdAt: '2026-03-23T10:00:00.000Z',
        updatedAt: '2026-03-23T10:00:00.000Z',
        creationSummary: {
          projectId: 'project-id',
          proposalId: 'proposal-id',
          finalTitle: 'Smart Campus Navigation',
          selectedTitleIndex: 1,
          advisorId: 'advisor-user-id',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Proposal is not eligible for project creation' })
  @ApiResponse({
    status: 409,
    description: 'Proposal review context is inconsistent or already used',
  })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async createProject(@Body() createData: CreateProjectDto, @GetUser() user: any) {
    return this.projectService.createProject(createData, user);
  }

  @Get(':id/overview')
  @ApiOperation({ summary: 'Get project overview detail' })
  @ApiResponse({ status: 200, description: 'Project overview retrieved' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async getProjectOverview(@Param('id') id: string, @GetUser() user: any) {
    return this.projectService.getProjectOverviewById(id, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project details' })
  @ApiResponse({ status: 200, description: 'Project details retrieved' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async getProjectById(@Param('id') id: string, @GetUser() user: any) {
    return this.projectService.getProjectById(id, user);
  }

  @Get(':id/members')
  @ApiOperation({ summary: 'List project members' })
  @ApiResponse({ status: 200, description: 'Project members retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async listProjectMembers(@Param('id') projectId: string, @GetUser() user: any) {
    return this.projectService.listProjectMembers(projectId, user);
  }

  @Put(':id/advisor')
  @Roles(ROLES.DEPARTMENT_HEAD, ROLES.COORDINATOR)
  @ApiOperation({ summary: 'Assign/reassign project advisor' })
  @ApiResponse({ status: 200, description: 'Advisor assigned successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async assignAdvisor(
    @Param('id') projectId: string,
    @Body() assignData: AssignAdvisorDto,
    @GetUser() user: any
  ) {
    return this.projectService.assignAdvisor(projectId, assignData, user);
  }

  // Project member management
  @Post(':id/members')
  @Roles(ROLES.DEPARTMENT_HEAD, ROLES.COORDINATOR, ROLES.PLATFORM_ADMIN)
  @ApiOperation({ summary: 'Add a student member to a project (enforces department group size)' })
  @ApiResponse({ status: 201, description: 'Student added successfully' })
  @ApiResponse({ status: 400, description: 'Invalid operation (e.g., maxGroupSize exceeded)' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async addStudentMember(
    @Param('id') projectId: string,
    @Body() dto: AddProjectMemberDto,
    @GetUser() user: any
  ) {
    return this.projectService.addStudentMember(projectId, dto, user);
  }

  @Delete(':id/members/:userId')
  @Roles(ROLES.DEPARTMENT_HEAD, ROLES.COORDINATOR, ROLES.PLATFORM_ADMIN)
  @ApiOperation({
    summary: 'Remove a student member from a project (enforces department group size)',
  })
  @ApiResponse({ status: 200, description: 'Student removed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid operation (e.g., minGroupSize violated)' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async removeStudentMember(
    @Param('id') projectId: string,
    @Param('userId') memberUserId: string,
    @GetUser() user: any
  ) {
    return this.projectService.removeStudentMember(projectId, memberUserId, user);
  }

  // Milestone endpoints
  @Get(':id/milestones')
  @ApiOperation({ summary: 'Get project milestones' })
  @ApiResponse({ status: 200, description: 'Milestones retrieved successfully' })
  async getProjectMilestones(@Param('id') projectId: string, @GetUser() user: any) {
    return this.projectService.getProjectMilestones(projectId, user);
  }

  @Post('milestones/:id/submissions')
  @Roles(ROLES.STUDENT, ROLES.ADVISOR, ROLES.DEPARTMENT_HEAD, ROLES.COORDINATOR)
  @HttpCode(HttpStatus.CREATED)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @ApiOperation({ summary: 'Upload a milestone submission file (versioned)' })
  @ApiResponse({ status: 201, description: 'Milestone submission uploaded' })
  @ApiResponse({ status: 400, description: 'Invalid file or milestone state' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Milestone not found' })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 20 * 1024 * 1024, // 20MB
      },
      fileFilter: (req, file, cb) => {
        const allowed = new Set([
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ]);
        if (!allowed.has(file.mimetype)) {
          return cb(new BadRequestException('Invalid file type. Allowed: PDF, DOCX.'), false);
        }
        cb(null, true);
      },
    })
  )
  async uploadMilestoneSubmission(
    @Param('id') milestoneId: string,
    @GetUser() user: any,
    @UploadedFile() file: Express.Multer.File
  ) {
    return this.projectService.uploadMilestoneSubmission(milestoneId, file, user);
  }

  @Get('milestones/:id/submissions')
  @Roles(ROLES.STUDENT, ROLES.ADVISOR, ROLES.DEPARTMENT_HEAD, ROLES.COORDINATOR)
  @ApiOperation({ summary: 'List milestone submissions (version history)' })
  @ApiResponse({ status: 200, description: 'Milestone submissions retrieved' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Milestone not found' })
  async listMilestoneSubmissions(@Param('id') milestoneId: string, @GetUser() user: any) {
    return this.projectService.listMilestoneSubmissions(milestoneId, user);
  }

  @Post('milestones/:id/submissions/:submissionId/feedbacks')
  @Roles(ROLES.ADVISOR, ROLES.DEPARTMENT_HEAD, ROLES.COORDINATOR)
  @HttpCode(HttpStatus.CREATED)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        file: { type: 'string', format: 'binary' },
      },
      required: ['message'],
    },
  })
  @ApiOperation({
    summary: 'Add feedback to a milestone submission with an optional attachment',
  })
  @ApiResponse({ status: 201, description: 'Milestone submission feedback created' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Milestone submission not found' })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 20 * 1024 * 1024,
      },
      fileFilter: (req, file, cb) => {
        const allowed = new Set([
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ]);
        if (!allowed.has(file.mimetype)) {
          return cb(new BadRequestException('Invalid file type. Allowed: PDF, DOCX.'), false);
        }
        cb(null, true);
      },
    })
  )
  async addMilestoneSubmissionFeedback(
    @Param('id') milestoneId: string,
    @Param('submissionId') submissionId: string,
    @Body() dto: CreateMilestoneSubmissionFeedbackDto,
    @GetUser() user: any,
    @UploadedFile() file?: Express.Multer.File
  ) {
    return this.projectService.addMilestoneSubmissionFeedback(
      milestoneId,
      submissionId,
      dto,
      file,
      user
    );
  }

  @Get('milestones/:id/submissions/:submissionId/feedbacks')
  @Roles(ROLES.STUDENT, ROLES.ADVISOR, ROLES.DEPARTMENT_HEAD, ROLES.COORDINATOR)
  @ApiOperation({ summary: 'List feedback history for a milestone submission' })
  @ApiResponse({ status: 200, description: 'Milestone submission feedback retrieved' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Milestone submission not found' })
  async listMilestoneSubmissionFeedbacks(
    @Param('id') milestoneId: string,
    @Param('submissionId') submissionId: string,
    @GetUser() user: any
  ) {
    return this.projectService.listMilestoneSubmissionFeedbacks(
      milestoneId,
      submissionId,
      user
    );
  }

  @Put('milestones/:id/submissions/:submissionId/approve')
  @Roles(ROLES.ADVISOR, ROLES.DEPARTMENT_HEAD, ROLES.COORDINATOR)
  @ApiOperation({ summary: 'Approve a milestone submission as final' })
  @ApiResponse({ status: 200, description: 'Milestone submission approved' })
  @ApiResponse({ status: 400, description: 'Invalid milestone state' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Milestone or submission not found' })
  async approveMilestoneSubmission(
    @Param('id') milestoneId: string,
    @Param('submissionId') submissionId: string,
    @GetUser() user: any
  ) {
    return this.projectService.approveMilestoneSubmission(milestoneId, submissionId, user);
  }

  @Put('milestones/:id/status')
  @ApiOperation({ summary: 'Update milestone status' })
  @ApiResponse({ status: 200, description: 'Milestone status updated' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async updateMilestoneStatus(
    @Param('id') milestoneId: string,
    @Body() updateData: UpdateMilestoneStatusDto,
    @GetUser() user: any
  ) {
    return this.projectService.updateMilestoneStatus(milestoneId, updateData, user);
  }

}
