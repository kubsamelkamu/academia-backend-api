import { Process, Processor } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { EmailService } from '../email/email.service';

@Injectable()
@Processor('email')
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly emailService: EmailService) {
  }

  @Process('send-contact-email')
  async handleSendContactEmail(job: Job<any>): Promise<void> {
    const { name, email, subject, message } = job.data;

    this.logger.log(`Processing send-contact-email jobId=${String(job.id)}`);

    try {
      await this.emailService.sendContactEmailToSupport({
        name,
        email,
        subject,
        message,
      });

      await this.emailService.sendAcknowledgmentEmail({
        name,
        email,
      });

      this.logger.log(`Completed send-contact-email jobId=${String(job.id)}`);
    } catch (error) {
      const stack = error instanceof Error ? error.stack : String(error);
      this.logger.error(
        `Failed send-contact-email jobId=${String(job.id)}`,
        stack,
      );
      throw error;
    }
  }
}