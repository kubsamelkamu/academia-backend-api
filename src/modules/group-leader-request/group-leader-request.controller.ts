import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { ROLES } from '../../common/constants/roles.constants';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

import { GroupLeaderRequestService } from './group-leader-request.service';
import { ApplyGroupLeaderRequestDto } from './dto/apply-group-leader-request.dto';
import { ListGroupLeaderRequestsQueryDto } from './dto/list-group-leader-requests.query.dto';
import { ListPendingGroupLeaderRequestsQueryDto } from './dto/list-pending-group-leader-requests.query.dto';
import { RejectGroupLeaderRequestDto } from './dto/reject-group-leader-request.dto';

@ApiTags('Group Leader Requests')
@ApiBearerAuth('access-token')
@Controller({ path: 'group-leader-requests', version: '1' })
export class GroupLeaderRequestController {
  constructor(private readonly groupLeaderRequestService: GroupLeaderRequestService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.STUDENT)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Apply to become a group leader (one-time)' })
  @ApiResponse({ status: 201, description: 'Application submitted' })
  async apply(@GetUser() user: any, @Body() dto: ApplyGroupLeaderRequestDto) {
    return this.groupLeaderRequestService.apply(user, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.STUDENT)
  @Get('me')
  @ApiOperation({ summary: 'Get my group leader request status' })
  @ApiResponse({ status: 200, description: 'Status retrieved' })
  async myStatus(@GetUser() user: any) {
    return this.groupLeaderRequestService.getMyStatus(user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.DEPARTMENT_HEAD, ROLES.COORDINATOR)
  @Get()
  @ApiOperation({ summary: 'List group leader requests (all statuses, optional status filter)' })
  @ApiResponse({ status: 200, description: 'Requests retrieved' })
  async list(@GetUser() user: any, @Query() query: ListGroupLeaderRequestsQueryDto) {
    return this.groupLeaderRequestService.list(user, query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.DEPARTMENT_HEAD, ROLES.COORDINATOR)
  @Get('pending')
  @ApiOperation({ summary: 'List pending group leader requests (department head or coordinator)' })
  @ApiResponse({ status: 200, description: 'Pending requests retrieved' })
  async listPending(@GetUser() user: any, @Query() query: ListPendingGroupLeaderRequestsQueryDto) {
    return this.groupLeaderRequestService.listPending(user, query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.DEPARTMENT_HEAD, ROLES.COORDINATOR)
  @Get(':id')
  @ApiOperation({ summary: 'Get full group leader request and student detail' })
  @ApiResponse({ status: 200, description: 'Request detail retrieved' })
  async getById(@GetUser() user: any, @Param('id') requestId: string) {
    return this.groupLeaderRequestService.getById(user, requestId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.DEPARTMENT_HEAD, ROLES.COORDINATOR)
  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve a pending group leader request' })
  @ApiResponse({ status: 200, description: 'Request approved' })
  async approve(@GetUser() user: any, @Param('id') requestId: string) {
    return this.groupLeaderRequestService.approve(user, requestId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.DEPARTMENT_HEAD, ROLES.COORDINATOR)
  @Patch(':id/reject')
  @ApiOperation({ summary: 'Reject a pending group leader request' })
  @ApiResponse({ status: 200, description: 'Request rejected' })
  async reject(
    @GetUser() user: any,
    @Param('id') requestId: string,
    @Body() dto: RejectGroupLeaderRequestDto
  ) {
    return this.groupLeaderRequestService.reject(user, requestId, dto);
  }
}
