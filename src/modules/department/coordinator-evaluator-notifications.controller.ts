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

import { CoordinatorEvaluatorNotificationsService } from './coordinator-evaluator-notifications.service';
import { CreateCoordinatorEvaluatorNotificationDto } from './dto/create-coordinator-evaluator-notification.dto';
import {
  ListCoordinatorEvaluatorNotificationRecipientsQueryDto,
  ListCoordinatorEvaluatorNotificationsQueryDto,
} from './dto/list-coordinator-evaluator-notifications.dto';

@ApiTags('Coordinator Evaluator Notifications')
@Controller({ path: 'coordinator/evaluators/notifications', version: '1' })
export class CoordinatorEvaluatorNotificationsController {
  constructor(private readonly service: CoordinatorEvaluatorNotificationsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.COORDINATOR)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Send a notification to one, many, or all evaluators in the department' })
  @ApiResponse({ status: 201, description: 'Evaluator notification campaign created and dispatched' })
  async send(@GetUser() user: any, @Body() dto: CreateCoordinatorEvaluatorNotificationDto) {
    return this.service.send(user, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.COORDINATOR)
  @Get('recipients')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List eligible evaluator recipients for a stage' })
  @ApiResponse({ status: 200, description: 'Evaluator recipients retrieved' })
  async listRecipients(
    @GetUser() user: any,
    @Query() query: ListCoordinatorEvaluatorNotificationRecipientsQueryDto
  ) {
    return this.service.listRecipients(user, query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.COORDINATOR)
  @Get('history/summary')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get coordinator evaluator notification history summary' })
  @ApiResponse({ status: 200, description: 'Evaluator notification history summary retrieved' })
  async getHistorySummary(
    @GetUser() user: any,
    @Query() query: ListCoordinatorEvaluatorNotificationsQueryDto
  ) {
    return this.service.getHistorySummary(user, query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.COORDINATOR)
  @Get('history')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List coordinator evaluator notification history' })
  @ApiResponse({ status: 200, description: 'Evaluator notification history retrieved' })
  async listHistory(
    @GetUser() user: any,
    @Query() query: ListCoordinatorEvaluatorNotificationsQueryDto
  ) {
    return this.service.listHistory(user, query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.COORDINATOR)
  @Get('history/:campaignId')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get one coordinator evaluator notification history item' })
  @ApiResponse({ status: 200, description: 'Evaluator notification history detail retrieved' })
  async getHistoryDetail(@GetUser() user: any, @Param('campaignId') campaignId: string) {
    return this.service.getHistoryDetail(user, campaignId);
  }
}