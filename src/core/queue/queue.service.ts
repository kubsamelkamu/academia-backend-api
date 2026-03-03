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

type TransactionalTemplateEmailJob = {
  to: {
    email: string;
    name?: string;
  };
  templateId: number;
  params?: Record<string, unknown>;
  replyTo?: {
    email: string;
    name?: string;
  };
};

@Injectable()
export class QueueService {
  constructor(
    @InjectQueue('email') private readonly emailQueue: Queue,
    @InjectQueue('invitations') private readonly invitationsQueue: Queue
  ) {}

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

  async addTransactionalTemplateEmailJob(data: TransactionalTemplateEmailJob): Promise<void> {
    await this.emailQueue.add('send-transactional-template-email', data, {
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 5_000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    });
  }

  async addBulkInviteStudentsJob(data: {
    tenantId: string;
    inviterId: string;
    departmentId: string;
    invites: Array<{ email: string; firstName: string; lastName: string }>;
    customSubject?: string;
    customMessage?: string;
  }): Promise<string> {
    const job = await this.invitationsQueue.add('bulk-invite-students', data, {
      attempts: 1,
      removeOnComplete: 100,
      removeOnFail: false,
    });

    return String(job.id);
  }

  async getBulkInviteStudentsJob(jobId: string) {
    return this.invitationsQueue.getJob(jobId);
  }
}
