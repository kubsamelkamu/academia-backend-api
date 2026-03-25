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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { ROLES } from '../../common/constants/roles.constants';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

import { CreateProjectGroupTaskDto } from './dto/create-project-group-task.dto';
import { UpdateProjectGroupTaskDto } from './dto/update-project-group-task.dto';
import { UpdateProjectGroupTaskStatusDto } from './dto/update-project-group-task-status.dto';
import { UpdateProjectGroupTaskAssigneeDto } from './dto/update-project-group-task-assignee.dto';
import { ProjectGroupTaskService } from './project-group-task.service';

@ApiTags('Project Group Tasks')
@ApiBearerAuth('access-token')
@Controller({ path: 'project-groups', version: '1' })
export class ProjectGroupTaskController {
  constructor(private readonly projectGroupTaskService: ProjectGroupTaskService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.STUDENT)
  @Post('me/tasks')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a task in my approved group (members)' })
  @ApiResponse({ status: 201, description: 'Task created' })
  async create(@GetUser() user: any, @Body() dto: CreateProjectGroupTaskDto) {
    return this.projectGroupTaskService.createTaskForMyGroup(user, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.STUDENT)
  @Get('me/tasks')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List tasks for my approved group (members)' })
  @ApiResponse({ status: 200, description: 'Tasks retrieved' })
  async list(@GetUser() user: any) {
    return this.projectGroupTaskService.listTasksForMyGroup(user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.STUDENT)
  @Get('me/tasks/:taskId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a task from my approved group (members)' })
  @ApiResponse({ status: 200, description: 'Task retrieved' })
  async get(@GetUser() user: any, @Param('taskId') taskId: string) {
    return this.projectGroupTaskService.getTaskForMyGroup(user, taskId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.STUDENT)
  @Patch('me/tasks/:taskId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update task details (creator or group leader)' })
  @ApiResponse({ status: 200, description: 'Task updated' })
  async updateDetails(
    @GetUser() user: any,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateProjectGroupTaskDto
  ) {
    return this.projectGroupTaskService.updateTaskDetailsForMyGroup(user, taskId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.STUDENT)
  @Patch('me/tasks/:taskId/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update task status (assignee or group leader)' })
  @ApiResponse({ status: 200, description: 'Task status updated' })
  async updateStatus(
    @GetUser() user: any,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateProjectGroupTaskStatusDto
  ) {
    return this.projectGroupTaskService.updateTaskStatusForMyGroup(user, taskId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.STUDENT)
  @Patch('me/tasks/:taskId/assignee')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reassign or unassign a task (group leader only)' })
  @ApiResponse({ status: 200, description: 'Task assignee updated' })
  async updateAssignee(
    @GetUser() user: any,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateProjectGroupTaskAssigneeDto
  ) {
    return this.projectGroupTaskService.updateTaskAssigneeForMyGroupLeader(user, taskId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.STUDENT)
  @Delete('me/tasks/:taskId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a task (creator or group leader; hard delete)' })
  @ApiResponse({ status: 200, description: 'Task deleted' })
  async delete(@GetUser() user: any, @Param('taskId') taskId: string) {
    return this.projectGroupTaskService.deleteTaskForMyGroup(user, taskId);
  }
}
