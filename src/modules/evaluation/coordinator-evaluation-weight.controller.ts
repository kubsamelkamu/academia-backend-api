import { Body, Controller, Get, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ROLES } from '../../common/constants/roles.constants';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EvaluationStageQueryDto, UpdateDepartmentStageEvaluationWeightDto } from './dto';
import { CoordinatorEvaluationWeightService } from './coordinator-evaluation-weight.service';

@ApiTags('Project Evaluations')
@Controller({ path: 'project-evaluations/coordinator', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('access-token')
@Roles(ROLES.COORDINATOR)
export class CoordinatorEvaluationWeightController {
  constructor(private readonly service: CoordinatorEvaluationWeightService) {}

  @Get('weights')
  @ApiOperation({ summary: 'Get department grading weights for a project evaluation stage' })
  @ApiResponse({ status: 200, description: 'Department grading weights retrieved successfully' })
  async getWeights(@GetUser() user: any, @Query() query: EvaluationStageQueryDto) {
    return this.service.getWeights(user, query);
  }

  @Put('weights')
  @ApiOperation({ summary: 'Create or update department grading weights for a project evaluation stage' })
  @ApiResponse({ status: 200, description: 'Department grading weights saved successfully' })
  async updateWeights(
    @GetUser() user: any,
    @Body() body: UpdateDepartmentStageEvaluationWeightDto
  ) {
    return this.service.updateWeights(user, body);
  }
}