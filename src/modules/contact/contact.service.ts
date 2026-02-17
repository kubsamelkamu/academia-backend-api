import { Injectable } from '@nestjs/common';
import { QueueService } from '../../core/queue/queue.service';
import { ContactDto } from './dto/contact.dto';

@Injectable()
export class ContactService {
  constructor(private readonly queueService: QueueService) {}

  async sendContactEmail(contactData: ContactDto): Promise<void> {
    await this.queueService.addEmailJob(contactData);
  }
}