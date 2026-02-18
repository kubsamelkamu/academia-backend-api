import { Module } from '@nestjs/common';
import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';
import { QueueModule } from '../../core/queue/queue.module';

@Module({
  imports: [QueueModule],
  controllers: [ContactController],
  providers: [ContactService],
})
export class ContactModule {}