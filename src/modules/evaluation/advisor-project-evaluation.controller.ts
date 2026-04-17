import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ROLES } from '../../common/constants/roles.constants';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { AdvisorProjectEvaluationService } from './advisor-project-evaluation.service';
import { EvaluationStageQueryDto, SaveAdvisorProjectEvaluationDraftDto } from './dto';

@ApiTags('Project Evaluations')
@Controller({ path: 'project-evaluations/advisors/me', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('access-token')
@Roles(ROLES.ADVISOR)
export class AdvisorProjectEvaluationController {
  constructor(private readonly advisorProjectEvaluationService: AdvisorProjectEvaluationService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get advisor project evaluation dashboard for a grading stage' })
  @ApiResponse({ status: 200, description: 'Advisor evaluation dashboard retrieved successfully' })
  async getDashboard(@GetUser() user: any, @Query() query: EvaluationStageQueryDto) {
    return this.advisorProjectEvaluationService.getAdvisorDashboard(user, query);
  }

  @Get('projects/:projectId')
  @ApiOperation({ summary: 'Get advisor project evaluation detail for a single advised project' })
  @ApiResponse({ status: 200, description: 'Advisor project evaluation detail retrieved successfully' })
  async getProjectDetail(
    @GetUser() user: any,
    @Param('projectId') projectId: string,
    @Query() query: EvaluationStageQueryDto
  ) {
    return this.advisorProjectEvaluationService.getAdvisorProjectDetail(user, projectId, query);
  }

  @Post('projects/:projectId/draft')
  @ApiOperation({ summary: 'Save advisor project evaluation draft scores for a grading stage' })
  @ApiResponse({ status: 201, description: 'Advisor project evaluation draft saved successfully' })
  async saveDraft(
    @GetUser() user: any,
    @Param('projectId') projectId: string,
    @Query() query: EvaluationStageQueryDto,
    @Body() body: SaveAdvisorProjectEvaluationDraftDto
  ) {
    return this.advisorProjectEvaluationService.saveAdvisorProjectDraft(user, projectId, query, body);
  }

  @Post('projects/:projectId/submit')
  @ApiOperation({ summary: 'Submit advisor project evaluation for a grading stage' })
  @ApiResponse({ status: 201, description: 'Advisor project evaluation submitted successfully' })
  async submitEvaluation(
    @GetUser() user: any,
    @Param('projectId') projectId: string,
    @Query() query: EvaluationStageQueryDto
  ) {
    return this.advisorProjectEvaluationService.submitAdvisorProjectEvaluation(user, projectId, query);
  }
}