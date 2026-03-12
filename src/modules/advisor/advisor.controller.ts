import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Patch,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiOperation,
    ApiResponse,
    ApiTags
} from '@nestjs/swagger';
import { User } from '@prisma/client';
import { GetUser } from '../../common/decorators/get-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdvisorService } from './advisor.service';
import { CreateEvaluationDto, UpdateEvaluationDto } from './dto/advisor-evaluation.dto';
import { AdvisorFilterDto } from './dto/advisor-filter.dto';
import { AdvisorResponseDto } from './dto/advisor-response.dto';
import { CreateReviewDto, UpdateReviewDto } from './dto/advisor-review.dto';
import { AssignProjectDto } from './dto/assign-project.dto';
import { CreateAdvisorDto } from './dto/create-advisor.dto';
import { UpdateAdvisorDto } from './dto/update-advisor.dto';

@ApiTags('advisors')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('advisors')
export class AdvisorController {
  constructor(private readonly advisorService: AdvisorService) {}

  @Post()
  @Roles('PLATFORM_ADMIN', 'TENANT_ADMIN', 'DEPARTMENT_HEAD')
  @ApiOperation({ summary: 'Create a new advisor' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Advisor created successfully',
    type: AdvisorResponseDto,
  })
  async create(
    @Body() createAdvisorDto: CreateAdvisorDto,
    @GetUser() user: User,
  ) {
    return this.advisorService.create(createAdvisorDto, user.tenantId);
  }

  @Get()
  @Roles('PLATFORM_ADMIN', 'TENANT_ADMIN', 'DEPARTMENT_HEAD', 'ADVISOR')
  @ApiOperation({ summary: 'Get all advisors with filtering and pagination' })
  async findAll(
    @Query() filterDto: AdvisorFilterDto,
    @GetUser() user: User,
  ) {
    return this.advisorService.findAll(filterDto, user.tenantId);
  }

  @Get('statistics')
  @Roles('PLATFORM_ADMIN', 'TENANT_ADMIN', 'DEPARTMENT_HEAD')
  @ApiOperation({ summary: 'Get advisor statistics' })
  async getStatistics(@GetUser() user: User) {
    return this.advisorService.getStatistics(user.tenantId);
  }

  @Get('availability/:id')
  @Roles('PLATFORM_ADMIN', 'TENANT_ADMIN', 'DEPARTMENT_HEAD', 'ADVISOR')
  @ApiOperation({ summary: 'Check advisor availability' })
  async checkAvailability(
    @Param('id') id: string,
    @GetUser() user: User,
  ) {
    return this.advisorService.checkAvailability(id, user.tenantId);
  }

  @Get('dashboard/:id')
  @Roles('ADVISOR')
  @ApiOperation({ summary: 'Get advisor dashboard data' })
  async getDashboard(
    @Param('id') id: string,
    @GetUser() user: User,
  ) {
    return this.advisorService.getDashboardData(id, user.tenantId);
  }

  @Get(':id')
  @Roles('PLATFORM_ADMIN', 'TENANT_ADMIN', 'DEPARTMENT_HEAD', 'ADVISOR')
  @ApiOperation({ summary: 'Get advisor by ID' })
  async findOne(
    @Param('id') id: string,
    @GetUser() user: User,
  ) {
    return this.advisorService.findOne(id, user.tenantId);
  }

  @Get(':id/projects')
  @Roles('PLATFORM_ADMIN', 'TENANT_ADMIN', 'DEPARTMENT_HEAD', 'ADVISOR')
  @ApiOperation({ summary: 'Get all projects assigned to an advisor' })
  async getAdvisorProjects(
    @Param('id') id: string,
    @Query('status') status: string,
    @GetUser() user: User,
  ) {
    return this.advisorService.getAdvisorProjects(id, status, user.tenantId);
  }

  @Get(':id/evaluations')
  @Roles('PLATFORM_ADMIN', 'TENANT_ADMIN', 'DEPARTMENT_HEAD', 'ADVISOR')
  @ApiOperation({ summary: 'Get all evaluations by an advisor' })
  async getAdvisorEvaluations(
    @Param('id') id: string,
    @Query('status') status: string,
    @GetUser() user: User,
  ) {
    return this.advisorService.getAdvisorEvaluations(id, status, user.tenantId);
  }

  @Get(':id/reviews')
  @Roles('PLATFORM_ADMIN', 'TENANT_ADMIN', 'DEPARTMENT_HEAD', 'ADVISOR')
  @ApiOperation({ summary: 'Get all milestone reviews by an advisor' })
  async getAdvisorReviews(
    @Param('id') id: string,
    @Query('status') status: string,
    @GetUser() user: User,
  ) {
    return this.advisorService.getAdvisorReviews(id, status, user.tenantId);
  }

  @Patch(':id')
  @Roles('PLATFORM_ADMIN', 'TENANT_ADMIN', 'DEPARTMENT_HEAD')
  @ApiOperation({ summary: 'Update advisor information' })
  async update(
    @Param('id') id: string,
    @Body() updateAdvisorDto: UpdateAdvisorDto,
    @GetUser() user: User,
  ) {
    return this.advisorService.update(id, updateAdvisorDto, user.tenantId);
  }

  @Delete(':id')
  @Roles('PLATFORM_ADMIN', 'TENANT_ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an advisor' })
  async remove(
    @Param('id') id: string,
    @GetUser() user: User,
  ) {
    await this.advisorService.remove(id, user.tenantId);
  }

  @Post(':id/projects')
  @Roles('PLATFORM_ADMIN', 'TENANT_ADMIN', 'DEPARTMENT_HEAD')
  @ApiOperation({ summary: 'Assign a project to advisor' })
  async assignProject(
    @Param('id') id: string,
    @Body() assignProjectDto: AssignProjectDto,
    @GetUser() user: User,
  ) {
    return this.advisorService.assignProject(id, assignProjectDto, user.tenantId);
  }

  @Delete(':id/projects/:projectId')
  @Roles('PLATFORM_ADMIN', 'TENANT_ADMIN', 'DEPARTMENT_HEAD')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a project from advisor' })
  async removeProject(
    @Param('id') id: string,
    @Param('projectId') projectId: string,
    @GetUser() user: User,
  ) {
    await this.advisorService.removeProject(id, projectId, user.tenantId);
  }

  @Post('evaluations')
  @Roles('ADVISOR')
  @ApiOperation({ summary: 'Create an evaluation' })
  async createEvaluation(
    @Body() createEvaluationDto: CreateEvaluationDto,
    @GetUser() user: User,
  ) {
    return this.advisorService.createEvaluation(createEvaluationDto, user.id, user.tenantId);
  }

  @Patch('evaluations/:id')
  @Roles('ADVISOR')
  @ApiOperation({ summary: 'Update an evaluation' })
  async updateEvaluation(
    @Param('id') id: string,
    @Body() updateEvaluationDto: UpdateEvaluationDto,
    @GetUser() user: User,
  ) {
    return this.advisorService.updateEvaluation(id, updateEvaluationDto, user.id, user.tenantId);
  }

  @Post('reviews')
  @Roles('ADVISOR')
  @ApiOperation({ summary: 'Create a milestone review' })
  async createReview(
    @Body() createReviewDto: CreateReviewDto,
    @GetUser() user: User,
  ) {
    return this.advisorService.createReview(createReviewDto, user.id, user.tenantId);
  }

  @Patch('reviews/:id')
  @Roles('ADVISOR')
  @ApiOperation({ summary: 'Update a milestone review' })
  async updateReview(
    @Param('id') id: string,
    @Body() updateReviewDto: UpdateReviewDto,
    @GetUser() user: User,
  ) {
    return this.advisorService.updateReview(id, updateReviewDto, user.id, user.tenantId);
  }

  // NOTE: additional routes (notifications, bulk operations) are handled in service

}