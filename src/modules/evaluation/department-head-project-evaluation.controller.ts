import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ROLES } from '../../common/constants/roles.constants';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EvaluationStageQueryDto } from './dto';
import {
  ApproveDepartmentHeadProjectEvaluationDto,
  DepartmentHeadProjectEvaluationService,
  RejectDepartmentHeadProjectEvaluationDto,
} from './department-head-project-evaluation.service';

@ApiTags('Project Evaluations')
@Controller({ path: 'project-evaluations/department-head', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('access-token')
@Roles(ROLES.DEPARTMENT_HEAD)
export class DepartmentHeadProjectEvaluationController {
  constructor(private readonly service: DepartmentHeadProjectEvaluationService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get department-head project evaluation dashboard for a grading stage' })
  @ApiResponse({ status: 200, description: 'Department-head project evaluation dashboard retrieved successfully' })
  async getDashboard(@GetUser() user: any, @Query() query: EvaluationStageQueryDto) {
    return this.service.getDashboard(user, query);
  }

  @Get('projects/:projectId')
  @ApiOperation({ summary: 'Get department-head finalized project evaluation detail for a grading stage' })
  @ApiResponse({ status: 200, description: 'Department-head project evaluation detail retrieved successfully' })
  async getProjectDetail(
    @GetUser() user: any,
    @Param('projectId') projectId: string,
    @Query() query: EvaluationStageQueryDto
  ) {
    return this.service.getProjectDetail(user, projectId, query);
  }

  @Post('projects/:projectId/approve')
  @ApiOperation({ summary: 'Approve finalized project grades for a grading stage' })
  @ApiResponse({ status: 201, description: 'Finalized project grades approved successfully' })
  async approveProject(
    @GetUser() user: any,
    @Param('projectId') projectId: string,
    @Query() query: EvaluationStageQueryDto,
    @Body() body: ApproveDepartmentHeadProjectEvaluationDto
  ) {
    return this.service.approveProject(user, projectId, query, body);
  }

  @Post('projects/:projectId/reject')
  @ApiOperation({ summary: 'Reject finalized project grades for a grading stage' })
  @ApiResponse({ status: 201, description: 'Finalized project grades rejected successfully' })
  async rejectProject(
    @GetUser() user: any,
    @Param('projectId') projectId: string,
    @Query() query: EvaluationStageQueryDto,
    @Body() body: RejectDepartmentHeadProjectEvaluationDto
  ) {
    return this.service.rejectProject(user, projectId, query, body);
  }
}