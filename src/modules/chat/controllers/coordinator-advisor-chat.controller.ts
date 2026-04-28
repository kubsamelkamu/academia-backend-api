import { Controller, Get, HttpCode, HttpStatus, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { ROLES } from '../../../common/constants/roles.constants';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { GetUser } from '../../auth/decorators/get-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

import { CoordinatorAdvisorChatService } from '../coordinator-advisor-chat.service';
import { GetDirectChatRoomQueryDto } from '../dto/get-direct-chat-room.query.dto';
import { ListAdvisorCoordinatorsQueryDto } from '../dto/list-advisor-coordinators.query.dto';

@ApiTags('Chat')
@ApiBearerAuth('access-token')
@Controller({ path: 'coordinator-advisor-chat', version: '1' })
export class CoordinatorAdvisorChatController {
  constructor(private readonly coordinatorAdvisorChatService: CoordinatorAdvisorChatService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.COORDINATOR, ROLES.ADVISOR)
  @Get('room')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get or create a coordinator-advisor direct chat room' })
  @ApiResponse({ status: 200, description: 'Direct chat room retrieved' })
  async getOrCreateRoom(@GetUser() user: any, @Query() query: GetDirectChatRoomQueryDto) {
    return this.coordinatorAdvisorChatService.getOrCreateRoom(user, query.counterpartUserId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADVISOR)
  @Get('advisors/me/coordinators')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List coordinators visible to the authenticated advisor for direct chat' })
  @ApiResponse({ status: 200, description: 'Advisor-visible coordinators retrieved' })
  async listAdvisorVisibleCoordinators(
    @GetUser() user: any,
    @Query() query: ListAdvisorCoordinatorsQueryDto
  ) {
    return this.coordinatorAdvisorChatService.listAdvisorVisibleCoordinators(user, query);
  }
}
