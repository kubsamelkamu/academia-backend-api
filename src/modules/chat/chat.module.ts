import { Module } from '@nestjs/common';

import { StorageModule } from '../../core/storage/storage.module';
import { AuthModule } from '../auth/auth.module';

import { ChatService } from './chat.service';
import { ChatRepository } from './chat.repository';
import { ProjectGroupChatController } from './controllers/project-group-chat.controller';
import { ChatRoomsController } from './controllers/chat-rooms.controller';
import { ChatGateway } from './chat.gateway';

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [ProjectGroupChatController, ChatRoomsController],
  providers: [ChatService, ChatRepository, ChatGateway],
  exports: [ChatService],
})
export class ChatModule {}
