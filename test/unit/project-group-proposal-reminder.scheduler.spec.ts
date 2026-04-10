import { NOTIFICATION_EVENT_TYPES } from '../../src/common/constants/notifications.constants';
import { ProjectGroupProposalReminderScheduler } from '../../src/modules/project-group/project-group-proposal-reminder.scheduler';

describe('ProjectGroupProposalReminderScheduler', () => {
  const prisma: any = {
    projectGroupAnnouncement: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  const notificationService: any = {
    createNotification: jest.fn(),
  };

  const projectGroupRepository: any = {
    listProjectGroupUserIds: jest.fn(),
  };

  const projectEmailService: any = {
    sendProposalResubmissionReminder24hEmails: jest.fn(),
    sendProposalResubmissionReminder1hEmails: jest.fn(),
    sendProposalResubmissionDeadlinePassedEmails: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-29T12:00:00.000Z'));
    delete process.env.DYNO;
    delete process.env.WORKER;

    notificationService.createNotification.mockResolvedValue({ id: 'notification-1' });
    projectGroupRepository.listProjectGroupUserIds.mockResolvedValue(['user-1', 'user-2']);
    prisma.projectGroupAnnouncement.update.mockResolvedValue({ id: 'reminder-1' });
    projectEmailService.sendProposalResubmissionReminder24hEmails.mockResolvedValue(undefined);
    projectEmailService.sendProposalResubmissionReminder1hEmails.mockResolvedValue(undefined);
    projectEmailService.sendProposalResubmissionDeadlinePassedEmails.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('sends the 24h reminder once to project group members and updates the reminder marker', async () => {
    prisma.projectGroupAnnouncement.findMany.mockResolvedValue([
      {
        id: 'reminder-1',
        tenantId: 'tenant-1',
        departmentId: 'dept-1',
        projectGroupId: 'group-1',
        proposalId: 'proposal-1',
        title: 'Proposal resubmission',
        message: 'Revise the proposal before the deadline.',
        deadlineAt: new Date('2026-03-30T08:00:00.000Z'),
        disableAfterDeadline: true,
        expiredAt: null,
        reminder24hSentAt: null,
        reminder1hSentAt: null,
        deadlinePassedSentAt: null,
      },
    ]);

    const scheduler = new ProjectGroupProposalReminderScheduler(
      prisma,
      notificationService,
      projectGroupRepository,
      projectEmailService
    );

    await scheduler.handleProposalResubmissionReminders();

    expect(projectGroupRepository.listProjectGroupUserIds).toHaveBeenCalledWith('group-1');
    expect(notificationService.createNotification).toHaveBeenCalledTimes(2);
    expect(notificationService.createNotification).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        tenantId: 'tenant-1',
        userId: 'user-1',
        eventType: NOTIFICATION_EVENT_TYPES.PROPOSAL_RESUBMISSION_REMINDER_24H,
        title: 'Proposal resubmission deadline reminder',
        idempotencyKey: 'proposal_resubmission_reminder_24h:reminder-1:user-1',
      })
    );
    expect(projectEmailService.sendProposalResubmissionReminder24hEmails).toHaveBeenCalledWith(
      expect.objectContaining({
        proposalId: 'proposal-1',
        reminderId: 'reminder-1',
        reminderTitle: 'Proposal resubmission',
        reminderMessage: 'Revise the proposal before the deadline.',
      })
    );
    expect(prisma.projectGroupAnnouncement.update).toHaveBeenCalledWith({
      where: { id: 'reminder-1' },
      data: { reminder24hSentAt: new Date('2026-03-29T12:00:00.000Z') },
    });
  });

  it('marks the reminder expired after the deadline and sends the deadline-passed notification', async () => {
    prisma.projectGroupAnnouncement.findMany.mockResolvedValue([
      {
        id: 'reminder-1',
        tenantId: 'tenant-1',
        departmentId: 'dept-1',
        projectGroupId: 'group-1',
        proposalId: 'proposal-1',
        title: 'Proposal resubmission',
        message: 'Revise the proposal before the deadline.',
        deadlineAt: new Date('2026-03-29T11:00:00.000Z'),
        disableAfterDeadline: true,
        expiredAt: null,
        reminder24hSentAt: new Date('2026-03-29T00:00:00.000Z'),
        reminder1hSentAt: new Date('2026-03-29T10:00:00.000Z'),
        deadlinePassedSentAt: null,
      },
    ]);

    const scheduler = new ProjectGroupProposalReminderScheduler(
      prisma,
      notificationService,
      projectGroupRepository,
      projectEmailService
    );

    await scheduler.handleProposalResubmissionReminders();

    expect(notificationService.createNotification).toHaveBeenCalledTimes(2);
    expect(notificationService.createNotification).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        tenantId: 'tenant-1',
        userId: 'user-1',
        eventType: NOTIFICATION_EVENT_TYPES.PROPOSAL_RESUBMISSION_REMINDER_DEADLINE_PASSED,
        title: 'Proposal resubmission deadline passed',
        idempotencyKey: 'proposal_resubmission_reminder_deadline_passed:reminder-1:user-1',
      })
    );
    expect(projectEmailService.sendProposalResubmissionDeadlinePassedEmails).toHaveBeenCalledWith(
      expect.objectContaining({
        proposalId: 'proposal-1',
        reminderId: 'reminder-1',
        reminderMessage: 'Revise the proposal before the deadline.',
      })
    );
    expect(prisma.projectGroupAnnouncement.update).toHaveBeenCalledWith({
      where: { id: 'reminder-1' },
      data: {
        expiredAt: new Date('2026-03-29T12:00:00.000Z'),
        deadlinePassedSentAt: new Date('2026-03-29T12:00:00.000Z'),
      },
    });
  });

  it('does not resend deadline-passed email after it was already sent', async () => {
    prisma.projectGroupAnnouncement.findMany.mockResolvedValue([
      {
        id: 'reminder-1',
        tenantId: 'tenant-1',
        departmentId: 'dept-1',
        projectGroupId: 'group-1',
        proposalId: 'proposal-1',
        title: 'Proposal resubmission',
        message: 'Revise the proposal before the deadline.',
        deadlineAt: new Date('2026-03-29T11:00:00.000Z'),
        disableAfterDeadline: false,
        expiredAt: null,
        reminder24hSentAt: new Date('2026-03-29T00:00:00.000Z'),
        reminder1hSentAt: new Date('2026-03-29T10:00:00.000Z'),
        deadlinePassedSentAt: new Date('2026-03-29T11:01:00.000Z'),
      },
    ]);

    const scheduler = new ProjectGroupProposalReminderScheduler(
      prisma,
      notificationService,
      projectGroupRepository,
      projectEmailService
    );

    await scheduler.handleProposalResubmissionReminders();

    expect(notificationService.createNotification).not.toHaveBeenCalled();
    expect(projectEmailService.sendProposalResubmissionDeadlinePassedEmails).not.toHaveBeenCalled();
    expect(prisma.projectGroupAnnouncement.update).not.toHaveBeenCalled();
  });

  it('skips the scheduler on worker dynos', async () => {
    process.env.WORKER = 'true';
    const scheduler = new ProjectGroupProposalReminderScheduler(
      prisma,
      notificationService,
      projectGroupRepository,
      projectEmailService
    );

    await scheduler.handleProposalResubmissionReminders();

    expect(prisma.projectGroupAnnouncement.findMany).not.toHaveBeenCalled();
    expect(notificationService.createNotification).not.toHaveBeenCalled();
  });
});