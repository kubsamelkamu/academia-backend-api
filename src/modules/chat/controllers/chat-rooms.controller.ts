import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';

import { ROLES } from '../../../common/constants/roles.constants';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { GetUser } from '../../auth/decorators/get-user.decorator';

import { ChatService } from '../chat.service';
import { EditChatMessageDto } from '../dto/edit-chat-message.dto';
import { ListChatMessagesQueryDto } from '../dto/list-chat-messages.query.dto';
import { PinMessageDto } from '../dto/pin-message.dto';
import { MarkReadUpToDto } from '../dto/mark-read-up-to.dto';
import { SetReactionDto } from '../dto/set-reaction.dto';

@ApiTags('Chat')
@ApiBearerAuth('access-token')
@Controller({ path: 'chat-rooms', version: '1' })
export class ChatRoomsController {
  constructor(private readonly chatService: ChatService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.STUDENT, ROLES.ADVISOR)
  @Get(':roomId/messages')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List chat messages for a room (members; approved groups only)' })
  @ApiResponse({ status: 200, description: 'Messages retrieved' })
  async listMessages(
    @GetUser() user: any,
    @Param('roomId') roomId: string,
    @Query() query: ListChatMessagesQueryDto
  ) {
    return this.chatService.listMessages(user, {
      roomId,
      cursor: query.cursor,
      limit: query.limit ?? 30,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.STUDENT, ROLES.ADVISOR)
  @Post(':roomId/attachments')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload a chat attachment (single file; approved groups only)' })
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
    return this.chatService.uploadAttachment(user, roomId, file);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.STUDENT, ROLES.ADVISOR)
  @Post(':roomId/read-up-to')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark chat messages read up to a message id (fallback for sockets)' })
  @ApiResponse({ status: 200, description: 'Read state updated' })
  async markReadUpTo(
    @GetUser() user: any,
    @Param('roomId') roomId: string,
    @Body() dto: MarkReadUpToDto
  ) {
    return this.chatService.markReadUpTo(user, { roomId, messageId: dto.messageId });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.STUDENT, ROLES.ADVISOR)
  @Patch(':roomId/messages/:messageId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Edit a message (sender only; approved groups only)' })
  @ApiResponse({ status: 200, description: 'Message updated' })
  async editMessage(
    @GetUser() user: any,
    @Param('roomId') roomId: string,
    @Param('messageId') messageId: string,
    @Body() dto: EditChatMessageDto
  ) {
    return this.chatService.editMessage(user, { roomId, messageId, text: dto.text });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.STUDENT, ROLES.ADVISOR)
  @Delete(':roomId/messages/:messageId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a message (hard delete; sender only; approved groups only)' })
  @ApiResponse({ status: 200, description: 'Message deleted' })
  async deleteMessage(
    @GetUser() user: any,
    @Param('roomId') roomId: string,
    @Param('messageId') messageId: string
  ) {
    return this.chatService.deleteMessage(user, { roomId, messageId });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.STUDENT, ROLES.ADVISOR)
  @Post(':roomId/messages/:messageId/reaction')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set reaction on a message (max 1 per user)' })
  @ApiResponse({ status: 200, description: 'Reaction set' })
  async setReaction(
    @GetUser() user: any,
    @Param('roomId') roomId: string,
    @Param('messageId') messageId: string,
    @Body() dto: SetReactionDto
  ) {
    return this.chatService.setReaction(user, { roomId, messageId, emoji: dto.emoji });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.STUDENT, ROLES.ADVISOR)
  @Delete(':roomId/messages/:messageId/reaction')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove my reaction from a message' })
  @ApiResponse({ status: 200, description: 'Reaction removed' })
  async removeReaction(
    @GetUser() user: any,
    @Param('roomId') roomId: string,
    @Param('messageId') messageId: string
  ) {
    return this.chatService.removeReaction(user, { roomId, messageId });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.STUDENT, ROLES.ADVISOR)
  @Get(':roomId/pins')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List pinned messages for a room' })
  @ApiResponse({ status: 200, description: 'Pins retrieved' })
  async listPins(@GetUser() user: any, @Param('roomId') roomId: string) {
    return this.chatService.listPins(user, { roomId });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.STUDENT, ROLES.ADVISOR)
  @Post(':roomId/pins')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pin a message (any room member)' })
  @ApiResponse({ status: 200, description: 'Message pinned' })
  async pinMessage(
    @GetUser() user: any,
    @Param('roomId') roomId: string,
    @Body() dto: PinMessageDto
  ) {
    return this.chatService.addPin(user, { roomId, messageId: dto.messageId });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.STUDENT, ROLES.ADVISOR)
  @Delete(':roomId/pins/:messageId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unpin a message (any room member)' })
  @ApiResponse({ status: 200, description: 'Message unpinned' })
  async unpinMessage(
    @GetUser() user: any,
    @Param('roomId') roomId: string,
    @Param('messageId') messageId: string
  ) {
    return this.chatService.removePin(user, { roomId, messageId });
  }
}
