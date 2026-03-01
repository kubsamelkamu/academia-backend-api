import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { ROLES } from '../../common/constants/roles.constants';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { MilestoneTemplatesService } from './milestone-templates.service';
import { CreateMilestoneTemplateDto, ListMilestoneTemplatesQueryDto, UpdateMilestoneTemplateDto } from './dto';

@ApiTags('Milestone Templates')
@Controller({ path: 'departments/:departmentId/milestone-templates', version: '1' })
export class MilestoneTemplatesController {
  constructor(private readonly milestoneTemplatesService: MilestoneTemplatesService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.DEPARTMENT_HEAD, ROLES.COORDINATOR, ROLES.ADVISOR, ROLES.STUDENT)
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List all milestone templates for a department' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'isActive', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiResponse({ status: 200, description: 'Milestone templates retrieved successfully' })
  async list(
    @Param('departmentId') departmentId: string,
    @Query() query: ListMilestoneTemplatesQueryDto,
    @GetUser() user: any
  ) {
    return this.milestoneTemplatesService.listMilestoneTemplates(departmentId, query, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.DEPARTMENT_HEAD, ROLES.COORDINATOR)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a milestone template for a department' })
  @ApiResponse({ status: 201, description: 'Milestone template created successfully' })
  async create(
    @Param('departmentId') departmentId: string,
    @Body() dto: CreateMilestoneTemplateDto,
    @GetUser() user: any
  ) {
    return this.milestoneTemplatesService.createMilestoneTemplate(departmentId, dto, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.DEPARTMENT_HEAD, ROLES.COORDINATOR)
  @Put(':templateId')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a milestone template for a department' })
  @ApiResponse({ status: 200, description: 'Milestone template updated successfully' })
  async update(
    @Param('departmentId') departmentId: string,
    @Param('templateId') templateId: string,
    @Body() dto: UpdateMilestoneTemplateDto,
    @GetUser() user: any
  ) {
    return this.milestoneTemplatesService.updateMilestoneTemplate(departmentId, templateId, dto, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.DEPARTMENT_HEAD, ROLES.COORDINATOR)
  @Delete(':templateId')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete a milestone template for a department' })
  @ApiResponse({ status: 200, description: 'Milestone template deleted successfully' })
  async remove(
    @Param('departmentId') departmentId: string,
    @Param('templateId') templateId: string,
    @GetUser() user: any
  ) {
    return this.milestoneTemplatesService.deleteMilestoneTemplate(departmentId, templateId, user);
  }
}
