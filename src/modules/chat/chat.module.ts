import { Module } from '@nestjs/common';

import { StorageModule } from '../../core/storage/storage.module';
import { AuthModule } from '../auth/auth.module';

import { ChatService } from './chat.service';
import { ChatRepository } from './chat.repository';
import { CoordinatorAdvisorChatRepository } from './coordinator-advisor-chat.repository';
import { CoordinatorAdvisorChatService } from './coordinator-advisor-chat.service';
import { ChatCallPresenceService } from './chat-call-presence.service';
import { CoordinatorAdvisorChatController } from './controllers/coordinator-advisor-chat.controller';
import { DirectChatRoomsController } from './controllers/direct-chat-rooms.controller';
import { ProjectGroupChatController } from './controllers/project-group-chat.controller';
import { ChatRoomsController } from './controllers/chat-rooms.controller';
import { ChatGateway } from './chat.gateway';

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [
    ProjectGroupChatController,
    ChatRoomsController,
    CoordinatorAdvisorChatController,
    DirectChatRoomsController,
  ],
  providers: [
    ChatService,
    ChatRepository,
    CoordinatorAdvisorChatRepository,
    CoordinatorAdvisorChatService,
    ChatCallPresenceService,
    ChatGateway,
  ],
  exports: [ChatService, CoordinatorAdvisorChatService],
})
export class ChatModule {}
