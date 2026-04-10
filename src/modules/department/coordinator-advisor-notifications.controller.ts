import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { ROLES } from '../../common/constants/roles.constants';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { CoordinatorAdvisorNotificationsService } from './coordinator-advisor-notifications.service';
import { CreateCoordinatorAdvisorNotificationDto } from './dto/create-coordinator-advisor-notification.dto';
import { ListCoordinatorAdvisorNotificationsQueryDto } from './dto/list-coordinator-advisor-notifications.dto';

@ApiTags('Coordinator Advisor Notifications')
@Controller({ path: 'coordinator/advisors/notifications', version: '1' })
export class CoordinatorAdvisorNotificationsController {
  constructor(private readonly service: CoordinatorAdvisorNotificationsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.COORDINATOR)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Send a notification to one, many, or all advisors in the department' })
  @ApiResponse({ status: 201, description: 'Notification campaign created and dispatched' })
  async send(@GetUser() user: any, @Body() dto: CreateCoordinatorAdvisorNotificationDto) {
    return this.service.send(user, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.COORDINATOR)
  @Get('history/summary')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get coordinator advisor notification history summary' })
  @ApiResponse({ status: 200, description: 'History summary retrieved' })
  async getHistorySummary(@GetUser() user: any) {
    return this.service.getHistorySummary(user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.COORDINATOR)
  @Get('history')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List coordinator advisor notification history' })
  @ApiResponse({ status: 200, description: 'History retrieved' })
  async listHistory(
    @GetUser() user: any,
    @Query() query: ListCoordinatorAdvisorNotificationsQueryDto
  ) {
    return this.service.listHistory(user, query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.COORDINATOR)
  @Get('history/:campaignId')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get one coordinator advisor notification history item' })
  @ApiResponse({ status: 200, description: 'History detail retrieved' })
  async getHistoryDetail(@GetUser() user: any, @Param('campaignId') campaignId: string) {
    return this.service.getHistoryDetail(user, campaignId);
  }
}