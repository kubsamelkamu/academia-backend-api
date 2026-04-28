import {
  BadRequestException,
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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';

import { ROLES } from '../../../common/constants/roles.constants';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { GetUser } from '../../auth/decorators/get-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

import { CoordinatorAdvisorChatService } from '../coordinator-advisor-chat.service';
import { EditChatMessageDto } from '../dto/edit-chat-message.dto';
import { ListChatMessagesQueryDto } from '../dto/list-chat-messages.query.dto';
import { MarkReadUpToDto } from '../dto/mark-read-up-to.dto';
import { PinMessageDto } from '../dto/pin-message.dto';
import { SetReactionDto } from '../dto/set-reaction.dto';
import { SendDirectChatMessageDto } from '../dto/send-direct-chat-message.dto';

@ApiTags('Chat')
@ApiBearerAuth('access-token')
@Controller({ path: 'direct-chat-rooms', version: '1' })
export class DirectChatRoomsController {
  constructor(private readonly coordinatorAdvisorChatService: CoordinatorAdvisorChatService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.COORDINATOR, ROLES.ADVISOR)
  @Post(':roomId/messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Send a message to a coordinator-advisor direct chat room' })
  @ApiResponse({ status: 201, description: 'Message sent' })
  async sendMessage(
    @GetUser() user: any,
    @Param('roomId') roomId: string,
    @Body() dto: SendDirectChatMessageDto
  ) {
    return this.coordinatorAdvisorChatService.sendMessage(user, {
      roomId,
      text: dto.text,
      replyToMessageId: dto.replyToMessageId,
      attachment:
        dto.attachment?.url && dto.attachment?.publicId
          ? {
              url: dto.attachment.url,
              publicId: dto.attachment.publicId,
              resourceType: dto.attachment.resourceType ?? 'raw',
              name: dto.attachment.name,
              mimeType: dto.attachment.mimeType,
              size: dto.attachment.size,
            }
          : null,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.COORDINATOR, ROLES.ADVISOR)
  @Get(':roomId/messages')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List messages for a coordinator-advisor direct chat room' })
  @ApiResponse({ status: 200, description: 'Messages retrieved' })
  async listMessages(
    @GetUser() user: any,
    @Param('roomId') roomId: string,
    @Query() query: ListChatMessagesQueryDto
  ) {
    return this.coordinatorAdvisorChatService.listMessages(user, {
      roomId,
      cursor: query.cursor,
      limit: query.limit ?? 30,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.COORDINATOR, ROLES.ADVISOR)
  @Post(':roomId/attachments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload a direct chat attachment (single file)' })
  @ApiResponse({ status: 201, description: 'Attachment uploaded' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        const allowed = new Set([
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/zip',
          'application/x-zip-compressed',
          'image/jpeg',
          'image/png',
        ]);
        if (!allowed.has(file.mimetype)) {
          return cb(
            new BadRequestException(
              'Invalid file type. Allowed: PDF, DOCX, PPTX, XLSX, ZIP, JPG, PNG.'
            ),
            false
          );
        }
        cb(null, true);
      },
    })
  )
  async uploadAttachment(
    @GetUser() user: any,
    @Param('roomId') roomId: string,
    @UploadedFile() file: Express.Multer.File
  ) {
    return this.coordinatorAdvisorChatService.uploadAttachment(user, roomId, file);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.COORDINATOR, ROLES.ADVISOR)
  @Post(':roomId/read-up-to')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark direct chat messages read up to a message id' })
  @ApiResponse({ status: 200, description: 'Read state updated' })
  async markReadUpTo(
    @GetUser() user: any,
    @Param('roomId') roomId: string,
    @Body() dto: MarkReadUpToDto
  ) {
    return this.coordinatorAdvisorChatService.markReadUpTo(user, {
      roomId,
      messageId: dto.messageId,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.COORDINATOR, ROLES.ADVISOR)
  @Patch(':roomId/messages/:messageId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Edit a direct chat message (sender only)' })
  @ApiResponse({ status: 200, description: 'Message updated' })
  async editMessage(
    @GetUser() user: any,
    @Param('roomId') roomId: string,
    @Param('messageId') messageId: string,
    @Body() dto: EditChatMessageDto
  ) {
    return this.coordinatorAdvisorChatService.editMessage(user, { roomId, messageId, text: dto.text });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.COORDINATOR, ROLES.ADVISOR)
  @Delete(':roomId/messages/:messageId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a direct chat message (sender only)' })
  @ApiResponse({ status: 200, description: 'Message deleted' })
  async deleteMessage(
    @GetUser() user: any,
    @Param('roomId') roomId: string,
    @Param('messageId') messageId: string
  ) {
    return this.coordinatorAdvisorChatService.deleteMessage(user, { roomId, messageId });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.COORDINATOR, ROLES.ADVISOR)
  @Post(':roomId/messages/:messageId/reaction')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set reaction on a direct chat message' })
  @ApiResponse({ status: 200, description: 'Reaction set' })
  async setReaction(
    @GetUser() user: any,
    @Param('roomId') roomId: string,
    @Param('messageId') messageId: string,
    @Body() dto: SetReactionDto
  ) {
    return this.coordinatorAdvisorChatService.setReaction(user, {
      roomId,
      messageId,
      emoji: dto.emoji,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.COORDINATOR, ROLES.ADVISOR)
  @Delete(':roomId/messages/:messageId/reaction')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove my reaction from a direct chat message' })
  @ApiResponse({ status: 200, description: 'Reaction removed' })
  async removeReaction(
    @GetUser() user: any,
    @Param('roomId') roomId: string,
    @Param('messageId') messageId: string
  ) {
    return this.coordinatorAdvisorChatService.removeReaction(user, { roomId, messageId });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.COORDINATOR, ROLES.ADVISOR)
  @Get(':roomId/pins')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List pinned direct chat messages for a room' })
  @ApiResponse({ status: 200, description: 'Pins retrieved' })
  async listPins(@GetUser() user: any, @Param('roomId') roomId: string) {
    return this.coordinatorAdvisorChatService.listPins(user, { roomId });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.COORDINATOR, ROLES.ADVISOR)
  @Post(':roomId/pins')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pin a direct chat message' })
  @ApiResponse({ status: 200, description: 'Message pinned' })
  async pinMessage(
    @GetUser() user: any,
    @Param('roomId') roomId: string,
    @Body() dto: PinMessageDto
  ) {
    return this.coordinatorAdvisorChatService.addPin(user, {
      roomId,
      messageId: dto.messageId,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.COORDINATOR, ROLES.ADVISOR)
  @Delete(':roomId/pins/:messageId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unpin a direct chat message' })
  @ApiResponse({ status: 200, description: 'Message unpinned' })
  async unpinMessage(
    @GetUser() user: any,
    @Param('roomId') roomId: string,
    @Param('messageId') messageId: string
  ) {
    return this.coordinatorAdvisorChatService.removePin(user, { roomId, messageId });
  }
}
