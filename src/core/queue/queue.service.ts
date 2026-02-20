import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

type ContactEmailJob = {
  name: string;
  email: string;
  subject: string;
  message: string;
};

type TransactionalEmailJob = {
  to: {
    email: string;
    name?: string;
  };
  subject: string;
  htmlContent: string;
  textContent?: string;
  replyTo?: {
    email: string;
    name?: string;
  };
};

@Injectable()
export class QueueService {
  constructor(@InjectQueue('email') private readonly emailQueue: Queue) {}

  async addEmailJob(data: ContactEmailJob): Promise<void> {
    await this.emailQueue.add('send-contact-email', data, {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 5_000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    });
  }

  async addTransactionalEmailJob(data: TransactionalEmailJob): Promise<void> {
    await this.emailQueue.add('send-transactional-email', data, {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 5_000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    });
  }
}
