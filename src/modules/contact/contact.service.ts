import { Injectable, Logger } from '@nestjs/common';
import { QueueService } from '../../core/queue/queue.service';
import { ContactDto } from './dto/contact.dto';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(private readonly queueService: QueueService) {}

  async sendContactEmail(contactData: ContactDto): Promise<void> {
    // Fire-and-forget to ensure the HTTP request returns quickly.
    void this.queueService.addEmailJob(contactData).catch((error) => {
      const stack = error instanceof Error ? error.stack : String(error);
      this.logger.error('Failed to enqueue contact email job', stack);
    });
  }
}
