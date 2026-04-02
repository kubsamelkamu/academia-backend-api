import { Controller, Get, HttpCode, HttpStatus, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { ROLES } from '../../../common/constants/roles.constants';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { GetUser } from '../../auth/decorators/get-user.decorator';

import { ChatService } from '../chat.service';
import { GetAdvisorChatRoomQueryDto } from '../dto/get-advisor-chat-room.query.dto';

@ApiTags('Chat')
@ApiBearerAuth('access-token')
@Controller({ path: 'project-groups', version: '1' })
export class ProjectGroupChatController {
  constructor(private readonly chatService: ChatService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.STUDENT)
  @Get('me/chat-room')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get (or create) my approved project group chat room' })
  @ApiResponse({ status: 200, description: 'Chat room retrieved' })
  async getMyChatRoom(@GetUser() user: any) {
    return this.chatService.getMyApprovedGroupChatRoom(user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADVISOR)
  @Get('advisors/me/chat-room')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get (or create) a supervised project group chat room (by project id)' })
  @ApiResponse({ status: 200, description: 'Chat room retrieved' })
  async getMySupervisedChatRoom(
    @GetUser() user: any,
    @Query() query: GetAdvisorChatRoomQueryDto
  ) {
    return this.chatService.getMySupervisedProjectGroupChatRoom(user, query.projectId);
  }
}
