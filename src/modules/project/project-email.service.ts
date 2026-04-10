import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../../core/email/email.service';
import { QueueService } from '../../core/queue/queue.service';
import { ProjectRepository } from './project.repository';

type Recipient = {
  userId?: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

@Injectable()
export class ProjectEmailService {
  private readonly logger = new Logger(ProjectEmailService.name);

  constructor(
    private readonly projectRepository: ProjectRepository,
    private readonly queueService: QueueService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService
  ) {}

  async sendProposalSubmittedEmails(params: {
    proposalId: string;
    tenantId: string;
    departmentId: string;
  }): Promise<void> {
    const templateId = this.configService.get<number>('email.proposalSubmittedTemplateId');
    if (!templateId) return;

    const [proposal, reviewers] = await Promise.all([
      this.projectRepository.findProposalById(params.proposalId),
      this.projectRepository.listDepartmentProposalReviewerContacts(
        params.tenantId,
        params.departmentId
      ),
    ]);

    if (!proposal || !reviewers.length) return;

    await this.sendTemplateToMany(
      reviewers.map((reviewer) => ({
        userId: reviewer.id,
        email: reviewer.email,
        firstName: reviewer.firstName,
        lastName: reviewer.lastName,
      })),
      templateId,
      {
        ...this.emailService.getCommonTemplateParams(),
        proposalId: proposal.id,
        proposalTitle: proposal.title,
        submitterName: this.fullName(proposal.submitter),
        submitterEmail: proposal.submitter?.email,
        departmentName: proposal.department?.name,
        groupName: (proposal as any).projectGroup?.name,
        status: proposal.status,
      }
    );
  }

  async sendProposalFeedbackAddedEmails(params: {
    proposalId: string;
    authorUserId: string;
    authorRole: string;
    messagePreview?: string;
  }): Promise<void> {
    const templateId = this.configService.get<number>('email.proposalFeedbackAddedTemplateId');
    if (!templateId) return;

    const proposal = await this.projectRepository.findProposalById(params.proposalId);
    if (!proposal) return;

    const recipients = this.getProposalRecipients(proposal).filter(
      (recipient) => recipient.userId !== params.authorUserId
    );

    if (!recipients.length) return;

    await this.sendTemplateToMany(recipients, templateId, {
      ...this.emailService.getCommonTemplateParams(),
      proposalId: proposal.id,
      proposalTitle: proposal.title,
      groupName: (proposal as any).projectGroup?.name,
      authorRole: params.authorRole,
      authorName: undefined,
      messagePreview: params.messagePreview,
      status: proposal.status,
    });
  }

  async sendProposalApprovedEmails(params: {
    proposalId: string;
    reviewerUserId: string;
  }): Promise<void> {
    const templateId = this.configService.get<number>('email.proposalApprovedTemplateId');
    if (!templateId) return;

    const proposal = await this.projectRepository.findProposalById(params.proposalId);
    if (!proposal) return;

    const recipients = this.getProposalRecipients(proposal);
    if (!recipients.length) return;

    await this.sendTemplateToMany(recipients, templateId, {
      ...this.emailService.getCommonTemplateParams(),
      proposalId: proposal.id,
      proposalTitle: proposal.title,
      groupName: (proposal as any).projectGroup?.name,
      departmentName: proposal.department?.name,
      status: proposal.status,
      advisorAssigned: Boolean(proposal.advisorId),
      advisorName: this.fullName(proposal.advisor),
      advisorEmail: proposal.advisor?.email,
    });
  }

  async sendProposalRejectedEmails(params: {
    proposalId: string;
    reviewerUserId: string;
    rejectionReason?: string;
  }): Promise<void> {
    const templateId = this.configService.get<number>('email.proposalRejectedTemplateId');
    if (!templateId) return;

    const proposal = await this.projectRepository.findProposalById(params.proposalId);
    if (!proposal) return;

    const recipients = this.getProposalRecipients(proposal);
    if (!recipients.length) return;

    await this.sendTemplateToMany(recipients, templateId, {
      ...this.emailService.getCommonTemplateParams(),
      proposalId: proposal.id,
      proposalTitle: proposal.title,
      groupName: (proposal as any).projectGroup?.name,
      departmentName: proposal.department?.name,
      status: proposal.status,
      rejectionReason: params.rejectionReason,
    });
  }

  async sendProposalResubmissionReminder24hEmails(params: {
    proposalId: string;
    reminderId: string;
    deadlineAt?: Date | string | null;
    reminderTitle?: string;
    reminderMessage?: string;
    remaining?: string;
  }): Promise<void> {
    await this.sendProposalResubmissionReminderEmails({
      ...params,
      templateConfigKey: 'email.proposalResubmissionReminder24hTemplateId',
      reminderType: '24h-or-late-catchup',
    });
  }

  async sendProposalResubmissionReminder1hEmails(params: {
    proposalId: string;
    reminderId: string;
    deadlineAt?: Date | string | null;
    reminderTitle?: string;
    reminderMessage?: string;
    remaining?: string;
  }): Promise<void> {
    await this.sendProposalResubmissionReminderEmails({
      ...params,
      templateConfigKey: 'email.proposalResubmissionReminder1hTemplateId',
      reminderType: '1h',
    });
  }

  async sendProposalResubmissionDeadlinePassedEmails(params: {
    proposalId: string;
    reminderId: string;
    deadlineAt?: Date | string | null;
    reminderTitle?: string;
    reminderMessage?: string;
  }): Promise<void> {
    await this.sendProposalResubmissionReminderEmails({
      ...params,
      templateConfigKey: 'email.proposalResubmissionDeadlinePassedTemplateId',
      reminderType: 'deadline-passed',
    });
  }

  async sendProjectAdvisorAssignedEmails(params: {
    projectId: string;
    advisorUserId: string;
    actorUserId?: string;
  }): Promise<void> {
    const templateId = this.configService.get<number>('email.projectAdvisorAssignedTemplateId');
    if (!templateId) return;

    const project = await this.projectRepository.findProjectById(params.projectId);
    if (!project) return;

    const recipients = this.getProjectRecipients(project);
    if (!recipients.length) return;

    await this.sendTemplateToMany(recipients, templateId, {
      ...this.emailService.getCommonTemplateParams(),
      projectId: project.id,
      projectTitle: project.title,
      departmentName: project.department?.name,
      advisorName: this.fullName(project.advisor),
      advisorEmail: project.advisor?.email,
    });
  }

  async sendProjectCreatedEmails(params: {
    projectId: string;
    actorUserId?: string;
  }): Promise<void> {
    const templateId = this.configService.get<number>('email.projectCreatedTemplateId');
    if (!templateId) return;

    const project = await this.projectRepository.findProjectById(params.projectId);
    if (!project) return;

    const recipients = this.getProjectRecipients(project);
    if (!recipients.length) return;

    await this.sendTemplateToMany(recipients, templateId, {
      ...this.emailService.getCommonTemplateParams(),
      projectId: project.id,
      projectTitle: project.title,
      proposalId: project.proposal?.id,
      proposalTitle: project.proposal?.title,
      departmentName: project.department?.name,
      advisorName: this.fullName(project.advisor),
      advisorEmail: project.advisor?.email,
      memberCount: Array.isArray(project.members) ? project.members.length : 0,
    });
  }

  private getProposalRecipients(proposal: any): Recipient[] {
    const groupMembers = Array.isArray(proposal?.projectGroup?.members)
      ? proposal.projectGroup.members.map((member: any) => ({
          userId: member?.user?.id,
          email: member?.user?.email,
          firstName: member?.user?.firstName,
          lastName: member?.user?.lastName,
        }))
      : [];

    if (groupMembers.length) {
      return this.uniqueRecipients(groupMembers);
    }

    return this.uniqueRecipients([
      {
        userId: proposal?.submitter?.id,
        email: proposal?.submitter?.email,
        firstName: proposal?.submitter?.firstName,
        lastName: proposal?.submitter?.lastName,
      },
    ]);
  }

  private getProjectRecipients(project: any): Recipient[] {
    const members = Array.isArray(project?.members)
      ? project.members.map((member: any) => ({
          userId: member?.user?.id,
          email: member?.user?.email,
          firstName: member?.user?.firstName,
          lastName: member?.user?.lastName,
        }))
      : [];

    const advisor = project?.advisor
      ? [
          {
            userId: project.advisor.id,
            email: project.advisor.email,
            firstName: project.advisor.firstName,
            lastName: project.advisor.lastName,
          },
        ]
      : [];

    return this.uniqueRecipients([...members, ...advisor]);
  }

  private async sendProposalResubmissionReminderEmails(params: {
    proposalId: string;
    reminderId: string;
    templateConfigKey: string;
    reminderType: '24h-or-late-catchup' | '1h' | 'deadline-passed';
    deadlineAt?: Date | string | null;
    reminderTitle?: string;
    reminderMessage?: string;
    remaining?: string;
  }): Promise<void> {
    const templateId = this.configService.get<number>(params.templateConfigKey);
    if (!templateId) return;

    const proposal = await this.projectRepository.findProposalById(params.proposalId);
    if (!proposal) return;

    const recipients = this.getProposalRecipients(proposal);
    if (!recipients.length) return;

    await this.sendTemplateToMany(recipients, templateId, {
      ...this.emailService.getCommonTemplateParams(),
      proposalId: proposal.id,
      proposalTitle: proposal.title,
      groupName: (proposal as any).projectGroup?.name,
      departmentName: proposal.department?.name,
      status: proposal.status,
      reminderId: params.reminderId,
      reminderType: params.reminderType,
      reminderTitle: params.reminderTitle,
      reminderMessage: params.reminderMessage,
      remaining: params.remaining,
      deadlineAt: params.deadlineAt ?? undefined,
      deadlinePassed: params.reminderType === 'deadline-passed',
    });
  }

  private uniqueRecipients(recipients: Recipient[]): Recipient[] {
    const dedup = new Map<string, Recipient>();

    for (const recipient of recipients) {
      const email = String(recipient?.email ?? '')
        .trim()
        .toLowerCase();
      if (!email) continue;
      if (!dedup.has(email)) {
        dedup.set(email, recipient);
      }
    }

    return Array.from(dedup.values());
  }

  private async sendTemplateToMany(
    recipients: Recipient[],
    templateId: number,
    params: Record<string, unknown>
  ): Promise<void> {
    const jobs = recipients.map((recipient) =>
      this.sendTemplateEmailBestEffort({
        to: {
          email: String(recipient.email),
          name: this.fullName(recipient),
        },
        templateId,
        params: {
          ...params,
          recipientName: this.fullName(recipient),
        },
      })
    );

    await Promise.allSettled(jobs);
  }

  private async sendTemplateEmailBestEffort(params: {
    to: { email: string; name?: string };
    templateId: number;
    params?: Record<string, unknown>;
  }): Promise<void> {
    const workerEnabled = (process.env.WORKER ?? '').toLowerCase() === 'true';
    const isDev = (process.env.NODE_ENV ?? 'development').toLowerCase() !== 'production';

    try {
      if (workerEnabled) {
        await this.queueService.addTransactionalTemplateEmailJob(params);
        return;
      }

      if (isDev) {
        await this.emailService.sendTransactionalTemplateEmail(params);
        return;
      }

      await this.queueService.addTransactionalTemplateEmailJob(params);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`ProjectEmail: failed enqueue/send (${message}); attempting direct-send`);
      try {
        await this.emailService.sendTransactionalTemplateEmail(params);
      } catch {
        // Best-effort.
      }
    }
  }

  private fullName(
    value:
      | {
          firstName?: string | null;
          lastName?: string | null;
        }
      | null
      | undefined
  ): string | undefined {
    const firstName = String(value?.firstName ?? '').trim();
    const lastName = String(value?.lastName ?? '').trim();
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || undefined;
  }
}
