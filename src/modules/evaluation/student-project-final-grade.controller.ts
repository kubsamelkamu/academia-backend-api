import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ROLES } from '../../common/constants/roles.constants';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EvaluationStageQueryDto } from './dto';
import { StudentProjectFinalGradeService } from './student-project-final-grade.service';

@ApiTags('Project Evaluations')
@Controller({ path: 'project-evaluations/students', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('access-token')
@Roles(ROLES.STUDENT)
export class StudentProjectFinalGradeController {
  constructor(private readonly service: StudentProjectFinalGradeService) {}

  @Get('me/final-grade')
  @ApiOperation({ summary: 'Get the logged-in student final grade for a grading stage' })
  @ApiResponse({ status: 200, description: 'Student final grade status retrieved successfully' })
  async getMyFinalGrade(@GetUser() user: any, @Query() query: EvaluationStageQueryDto) {
    return this.service.getMyFinalGrade(user, query);
  }
}