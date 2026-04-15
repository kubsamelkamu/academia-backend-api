import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ROLES } from '../../common/constants/roles.constants';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EvaluationStageQueryDto } from './dto';
import {
  CoordinatorProjectEvaluationService,
  FinalizeCoordinatorProjectEvaluationDto,
} from './coordinator-project-evaluation.service';
import { Body } from '@nestjs/common';

@ApiTags('Project Evaluations')
@Controller({ path: 'project-evaluations/coordinator', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('access-token')
@Roles(ROLES.COORDINATOR)
export class CoordinatorProjectEvaluationController {
  constructor(private readonly service: CoordinatorProjectEvaluationService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get coordinator project evaluation dashboard for a grading stage' })
  @ApiResponse({ status: 200, description: 'Coordinator project evaluation dashboard retrieved successfully' })
  async getDashboard(@GetUser() user: any, @Query() query: EvaluationStageQueryDto) {
    return this.service.getDashboard(user, query);
  }

  @Get('projects/:projectId')
  @ApiOperation({ summary: 'Get coordinator project evaluation detail for a grading stage' })
  @ApiResponse({ status: 200, description: 'Coordinator project evaluation detail retrieved successfully' })
  async getProjectDetail(
    @GetUser() user: any,
    @Param('projectId') projectId: string,
    @Query() query: EvaluationStageQueryDto
  ) {
    return this.service.getProjectDetail(user, projectId, query);
  }

  @Post('projects/:projectId/preview')
  @ApiOperation({ summary: 'Preview final grades for a coordinator project evaluation stage' })
  @ApiResponse({ status: 201, description: 'Coordinator final grade preview generated successfully' })
  async previewProject(
    @GetUser() user: any,
    @Param('projectId') projectId: string,
    @Query() query: EvaluationStageQueryDto
  ) {
    return this.service.previewProject(user, projectId, query);
  }

  @Post('projects/:projectId/finalize')
  @ApiOperation({ summary: 'Finalize coordinator project grades for a grading stage' })
  @ApiResponse({ status: 201, description: 'Coordinator final project grades finalized successfully' })
  async finalizeProject(
    @GetUser() user: any,
    @Param('projectId') projectId: string,
    @Query() query: EvaluationStageQueryDto,
    @Body() body: FinalizeCoordinatorProjectEvaluationDto
  ) {
    return this.service.finalizeProject(user, projectId, query, body);
  }
}