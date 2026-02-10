import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ProjectService } from './project.service';
import {
  ListProposalsDto,
  UpdateProposalStatusDto,
  ListProjectsDto,
  CreateProjectDto,
  AssignAdvisorDto,
  UpdateMilestoneStatusDto,
  ListAdvisorsDto,
  CheckAdvisorAvailabilityDto,
  SetAdvisorLoadLimitDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { ROLES } from '../../common/constants/roles.constants';

@ApiTags('Project Management')
@Controller({ path: 'projects', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  // Proposal endpoints
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

  @Get('proposals/:id')
  @ApiOperation({ summary: 'Get proposal details' })
  @ApiResponse({ status: 200, description: 'Proposal details retrieved' })
  @ApiResponse({ status: 404, description: 'Proposal not found' })
  async getProposalById(@Param('id') id: string, @GetUser() user: any) {
    return this.projectService.getProposalById(id, user);
  }

  @Put('proposals/:id/status')
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
  @ApiResponse({ status: 201, description: 'Project created successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async createProject(@Body() createData: CreateProjectDto, @GetUser() user: any) {
    return this.projectService.createProject(createData, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project details' })
  @ApiResponse({ status: 200, description: 'Project details retrieved' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async getProjectById(@Param('id') id: string, @GetUser() user: any) {
    return this.projectService.getProjectById(id, user);
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

  // Milestone endpoints
  @Get(':id/milestones')
  @ApiOperation({ summary: 'Get project milestones' })
  @ApiResponse({ status: 200, description: 'Milestones retrieved successfully' })
  async getProjectMilestones(@Param('id') projectId: string, @GetUser() user: any) {
    return this.projectService.getProjectMilestones(projectId, user);
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

  // Advisor endpoints
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
}
