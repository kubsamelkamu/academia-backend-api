import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';

import { ROLES } from '../../common/constants/roles.constants';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

import { CreateProjectGroupDto } from './dto/create-project-group.dto';
import { CreateProjectGroupInvitationDto } from './dto/create-project-group-invitation.dto';
import { BrowseProjectGroupsQueryDto } from './dto/browse-project-groups.query.dto';
import { CreateProjectGroupJoinRequestDto } from './dto/create-project-group-join-request.dto';
import { DecideProjectGroupReviewDto } from './dto/decide-project-group-review.dto';
import { DecideProjectGroupJoinRequestDto } from './dto/decide-project-group-join-request.dto';
import { ListAvailableStudentsQueryDto } from './dto/list-available-students.query.dto';
import { ListJoinRequestsQueryDto } from './dto/list-join-requests.query.dto';
import { ListSubmittedProjectGroupsQueryDto } from './dto/list-submitted-project-groups.query.dto';
import { ProjectGroupInvitationTokenQueryDto } from './dto/project-group-invitation-token.query.dto';
import { ProjectGroupService } from './project-group.service';

@ApiTags('Project Groups')
@ApiBearerAuth('access-token')
@Controller({ path: 'project-groups', version: '1' })
export class ProjectGroupController {
  constructor(
    private readonly projectGroupService: ProjectGroupService,
    private readonly config: ConfigService
  ) {}

  private getFrontendBaseUrl() {
    const raw = this.config.get<string>('app.frontendUrl') || 'http://localhost:3000';
    return raw.replace(/\/+$/, '');
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.STUDENT)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a group (approved group leaders only)' })
  @ApiResponse({ status: 201, description: 'Group created' })
  async create(@GetUser() user: any, @Body() dto: CreateProjectGroupDto) {
    return this.projectGroupService.createGroup(user, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.STUDENT)
  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get my group details (students: leader or member)' })
  @ApiResponse({ status: 200, description: 'Group retrieved' })
  async getMyGroup(@GetUser() user: any) {
    return this.projectGroupService.getMyGroup(user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.STUDENT)
  @Get('browse')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Browse groups by name (students)' })
  @ApiResponse({ status: 200, description: 'Groups retrieved' })
  async browseGroups(@GetUser() user: any, @Query() query: BrowseProjectGroupsQueryDto) {
    return this.projectGroupService.browseGroups(user, query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.STUDENT)
  @Post(':groupId/join-requests')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Request to join a group (students)' })
  @ApiResponse({ status: 201, description: 'Join request created' })
  async createJoinRequest(
    @GetUser() user: any,
    @Param('groupId') groupId: string,
    @Body() dto: CreateProjectGroupJoinRequestDto
  ) {
    return this.projectGroupService.createJoinRequest(user, groupId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.STUDENT)
  @Get('join-requests/me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List my join requests (students)' })
  @ApiResponse({ status: 200, description: 'Join requests retrieved' })
  async listMyJoinRequests(@GetUser() user: any, @Query() query: ListJoinRequestsQueryDto) {
    return this.projectGroupService.listMyJoinRequests(user, query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.STUDENT)
  @Delete('join-requests/:requestId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel my join request (students)' })
  @ApiResponse({ status: 200, description: 'Join request cancelled' })
  async cancelMyJoinRequest(@GetUser() user: any, @Param('requestId') requestId: string) {
    return this.projectGroupService.cancelMyJoinRequest(user, requestId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.STUDENT)
  @Get('me/join-requests')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List join requests for my group (group leaders)' })
  @ApiResponse({ status: 200, description: 'Join requests retrieved' })
  async listJoinRequestsForMyGroup(@GetUser() user: any, @Query() query: ListJoinRequestsQueryDto) {
    return this.projectGroupService.listJoinRequestsForMyGroupLeader(user, query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.STUDENT)
  @Post('me/join-requests/:requestId/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a join request (group leaders)' })
  @ApiResponse({ status: 200, description: 'Join request approved' })
  async approveJoinRequest(@GetUser() user: any, @Param('requestId') requestId: string) {
    return this.projectGroupService.approveJoinRequestForMyGroup(user, requestId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.STUDENT)
  @Post('me/join-requests/:requestId/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a join request (group leaders)' })
  @ApiResponse({ status: 200, description: 'Join request rejected' })
  async rejectJoinRequest(
    @GetUser() user: any,
    @Param('requestId') requestId: string,
    @Body() dto: DecideProjectGroupJoinRequestDto
  ) {
    return this.projectGroupService.rejectJoinRequestForMyGroup(user, requestId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.STUDENT)
  @Get('available-students')
  @ApiOperation({ summary: 'List students who are not in any group (approved group leaders only)' })
  @ApiResponse({ status: 200, description: 'Students retrieved' })
  async listAvailableStudents(@GetUser() user: any, @Query() query: ListAvailableStudentsQueryDto) {
    return this.projectGroupService.listAvailableStudents(user, query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.STUDENT)
  @Post('invitations')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Invite a student to join your group (approved group leaders only)' })
  @ApiResponse({ status: 201, description: 'Invitation created and email queued (best-effort)' })
  async inviteStudent(@GetUser() user: any, @Body() dto: CreateProjectGroupInvitationDto) {
    return this.projectGroupService.inviteStudentToMyGroup(user, dto);
  }

  @Public()
  @Get('invitations/accept')
  @Throttle({ default: { ttl: 300000, limit: 30 } })
  @ApiOperation({ summary: 'Accept a group invitation (token-only, one-click)' })
  @ApiResponse({ status: 200, description: 'Invitation accepted' })
  async acceptInvitation(@Query() query: ProjectGroupInvitationTokenQueryDto) {
    return this.projectGroupService.acceptInvitationByToken({ token: query.token });
  }

  @Public()
  @Get('invitations/accept/ui')
  @Throttle({ default: { ttl: 300000, limit: 60 } })
  @ApiOperation({ summary: 'Accept a group invitation (token-only) and redirect to frontend UI' })
  async acceptInvitationUi(
    @Query() query: ProjectGroupInvitationTokenQueryDto,
    @Res() res: Response
  ) {
    const frontendBase = this.getFrontendBaseUrl();

    try {
      const result = await this.projectGroupService.acceptInvitationByToken({ token: query.token });
      const url = `${frontendBase}/group-invitations/result?status=accepted&groupId=${encodeURIComponent(
        result.groupId
      )}&groupName=${encodeURIComponent(result.groupName)}`;
      return res.redirect(url);
    } catch (err: any) {
      const message = (err?.response?.message ||
        err?.message ||
        'Unable to accept invitation') as string;
      const url = `${frontendBase}/group-invitations/result?status=error&message=${encodeURIComponent(message)}`;
      return res.redirect(url);
    }
  }

  @Public()
  @Get('invitations/reject')
  @Throttle({ default: { ttl: 300000, limit: 30 } })
  @ApiOperation({ summary: 'Reject a group invitation (token-only, one-click)' })
  @ApiResponse({ status: 200, description: 'Invitation rejected' })
  async rejectInvitation(@Query() query: ProjectGroupInvitationTokenQueryDto) {
    return this.projectGroupService.rejectInvitationByToken({ token: query.token });
  }

  @Public()
  @Get('invitations/reject/ui')
  @Throttle({ default: { ttl: 300000, limit: 60 } })
  @ApiOperation({ summary: 'Reject a group invitation (token-only) and redirect to frontend UI' })
  async rejectInvitationUi(
    @Query() query: ProjectGroupInvitationTokenQueryDto,
    @Res() res: Response
  ) {
    const frontendBase = this.getFrontendBaseUrl();

    try {
      const result = await this.projectGroupService.rejectInvitationByToken({ token: query.token });
      const url = `${frontendBase}/group-invitations/result?status=rejected&groupId=${encodeURIComponent(
        result.groupId
      )}&groupName=${encodeURIComponent(result.groupName)}`;
      return res.redirect(url);
    } catch (err: any) {
      const message = (err?.response?.message ||
        err?.message ||
        'Unable to reject invitation') as string;
      const url = `${frontendBase}/group-invitations/result?status=error&message=${encodeURIComponent(message)}`;
      return res.redirect(url);
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.STUDENT)
  @Post('me/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit my group for department review (approved group leaders only)' })
  @ApiResponse({ status: 200, description: 'Group submitted' })
  async submitMyGroup(@GetUser() user: any) {
    return this.projectGroupService.submitMyGroupForReview(user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.STUDENT)
  @Post('me/reopen')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Re-open my rejected group back to draft (approved group leaders only)',
  })
  @ApiResponse({ status: 200, description: 'Group re-opened' })
  async reopenMyGroup(@GetUser() user: any) {
    return this.projectGroupService.reopenMyRejectedGroup(user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.DEPARTMENT_HEAD, ROLES.COORDINATOR)
  @Get('review/submitted')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List submitted groups for review (department head/coordinator)' })
  @ApiResponse({ status: 200, description: 'Submitted groups retrieved' })
  async listSubmittedGroupsForReview(
    @GetUser() user: any,
    @Query() query: ListSubmittedProjectGroupsQueryDto
  ) {
    return this.projectGroupService.listSubmittedGroupsForReview(user, query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.DEPARTMENT_HEAD, ROLES.COORDINATOR)
  @Post('review/:groupId/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a submitted group (department head/coordinator)' })
  @ApiResponse({ status: 200, description: 'Group approved' })
  async approveSubmittedGroup(@GetUser() user: any, @Param('groupId') groupId: string) {
    return this.projectGroupService.approveSubmittedGroup(user, groupId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.DEPARTMENT_HEAD, ROLES.COORDINATOR)
  @Post('review/:groupId/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a submitted group (department head/coordinator)' })
  @ApiResponse({ status: 200, description: 'Group rejected' })
  async rejectSubmittedGroup(
    @GetUser() user: any,
    @Param('groupId') groupId: string,
    @Body() dto: DecideProjectGroupReviewDto
  ) {
    return this.projectGroupService.rejectSubmittedGroup(user, groupId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.STUDENT)
  @Get(':groupId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get group details (students)' })
  @ApiResponse({ status: 200, description: 'Group retrieved' })
  async getGroupDetails(@GetUser() user: any, @Param('groupId') groupId: string) {
    return this.projectGroupService.getGroupDetailsForStudent(user, groupId);
  }
}
