import { Process, Processor } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import type { Job } from 'bull';
import { EmailService } from '../email/email.service';

@Injectable()
@Processor('email')
export class EmailProcessor {
  constructor(private readonly emailService: EmailService) {
  }

  @Process('send-contact-email')
  async handleSendContactEmail(job: Job<any>): Promise<void> {
    const { name, email, subject, message } = job.data;

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
  }
}