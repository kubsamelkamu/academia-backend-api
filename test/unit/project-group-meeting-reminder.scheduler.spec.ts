import { NOTIFICATION_EVENT_TYPES } from '../../src/common/constants/notifications.constants';
import { ProjectGroupMeetingReminderScheduler } from '../../src/modules/project-group/project-group-meeting-reminder.scheduler';

describe('ProjectGroupMeetingReminderScheduler', () => {
  const prisma: any = {
    projectGroupMeeting: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
  };

  const config: any = {
    get: jest.fn(),
  };

  const emailService: any = {
    sendTransactionalTemplateEmail: jest.fn(),
    getCommonTemplateParams: jest.fn(() => ({ appName: 'Academia' })),
  };

  const notificationService: any = {
    createNotification: jest.fn(),
  };

  const projectGroupRepository: any = {
    listProjectGroupUserIds: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-10T12:00:00.000Z'));
    delete process.env.DYNO;
    delete process.env.WORKER;

    notificationService.createNotification.mockResolvedValue({ id: 'n1' });
    projectGroupRepository.listProjectGroupUserIds.mockResolvedValue(['user-1', 'user-2']);
    prisma.projectGroupMeeting.update.mockResolvedValue({ id: 'meeting-1' });
    prisma.user.findMany.mockResolvedValue([
      { id: 'user-1', email: 'user1@example.com', firstName: 'User', lastName: 'One' },
      { id: 'user-2', email: 'user2@example.com', firstName: 'User', lastName: 'Two' },
    ]);
    emailService.sendTransactionalTemplateEmail.mockResolvedValue(undefined);
    config.get.mockImplementation((key: string) => {
      if (key === 'email.projectGroupMeetingReminder24hTemplateId') return 2401;
      if (key === 'email.projectGroupMeetingReminder1hTemplateId') return 1001;
      return undefined;
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('sends 24h reminder only when meeting is within 24h and updates marker once', async () => {
    prisma.projectGroupMeeting.findMany.mockResolvedValue([
      {
        id: 'meeting-1',
        tenantId: 'tenant-1',
        projectId: 'project-1',
        projectGroupId: 'group-1',
        title: 'Weekly Sync',
        meetingAt: new Date('2026-04-10T18:00:00.000Z'),
        durationMinutes: 60,
        agenda: 'Agenda',
        reminder24hSentAt: null,
        reminder1hSentAt: null,
      },
    ]);

    const scheduler = new ProjectGroupMeetingReminderScheduler(
      prisma,
      config,
      emailService,
      notificationService,
      projectGroupRepository
    );

    await scheduler.handleMeetingReminders();

    expect(notificationService.createNotification).toHaveBeenCalledTimes(2);
    expect(notificationService.createNotification).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        userId: 'user-1',
        eventType: NOTIFICATION_EVENT_TYPES.PROJECT_GROUP_MEETING_REMINDER_24H,
        idempotencyKey: expect.stringContaining('project_group_meeting_reminder_24h:meeting-1'),
      })
    );

    expect(emailService.sendTransactionalTemplateEmail).toHaveBeenCalledTimes(2);
    expect(emailService.sendTransactionalTemplateEmail).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        templateId: 2401,
        params: expect.objectContaining({
          reminderType: '24h',
          meetingId: 'meeting-1',
        }),
      })
    );

    expect(prisma.projectGroupMeeting.update).toHaveBeenCalledWith({
      where: { id: 'meeting-1' },
      data: { reminder24hSentAt: new Date('2026-04-10T12:00:00.000Z') },
    });
  });

  it('sends both 24h and 1h reminders in catch-up mode when within 1h and unsent', async () => {
    prisma.projectGroupMeeting.findMany.mockResolvedValue([
      {
        id: 'meeting-1',
        tenantId: 'tenant-1',
        projectId: 'project-1',
        projectGroupId: 'group-1',
        title: 'Urgent Sync',
        meetingAt: new Date('2026-04-10T12:30:00.000Z'),
        durationMinutes: 30,
        agenda: 'Urgent Agenda',
        reminder24hSentAt: null,
        reminder1hSentAt: null,
      },
    ]);

    const scheduler = new ProjectGroupMeetingReminderScheduler(
      prisma,
      config,
      emailService,
      notificationService,
      projectGroupRepository
    );

    await scheduler.handleMeetingReminders();

    expect(notificationService.createNotification).toHaveBeenCalledTimes(4);
    expect(emailService.sendTransactionalTemplateEmail).toHaveBeenCalledTimes(4);
    expect(prisma.projectGroupMeeting.update).toHaveBeenCalledWith({
      where: { id: 'meeting-1' },
      data: {
        reminder24hSentAt: new Date('2026-04-10T12:00:00.000Z'),
        reminder1hSentAt: new Date('2026-04-10T12:00:00.000Z'),
      },
    });
  });

  it('does not resend reminders when reminder markers are already set', async () => {
    prisma.projectGroupMeeting.findMany.mockResolvedValue([
      {
        id: 'meeting-1',
        tenantId: 'tenant-1',
        projectId: 'project-1',
        projectGroupId: 'group-1',
        title: 'Weekly Sync',
        meetingAt: new Date('2026-04-10T12:20:00.000Z'),
        durationMinutes: 30,
        agenda: 'Agenda',
        reminder24hSentAt: new Date('2026-04-09T12:00:00.000Z'),
        reminder1hSentAt: new Date('2026-04-10T11:30:00.000Z'),
      },
    ]);

    const scheduler = new ProjectGroupMeetingReminderScheduler(
      prisma,
      config,
      emailService,
      notificationService,
      projectGroupRepository
    );

    await scheduler.handleMeetingReminders();

    expect(notificationService.createNotification).not.toHaveBeenCalled();
    expect(emailService.sendTransactionalTemplateEmail).not.toHaveBeenCalled();
    expect(prisma.projectGroupMeeting.update).not.toHaveBeenCalled();
  });

  it('skips scheduler on worker dynos', async () => {
    process.env.WORKER = 'true';

    const scheduler = new ProjectGroupMeetingReminderScheduler(
      prisma,
      config,
      emailService,
      notificationService,
      projectGroupRepository
    );

    await scheduler.handleMeetingReminders();

    expect(prisma.projectGroupMeeting.findMany).not.toHaveBeenCalled();
    expect(notificationService.createNotification).not.toHaveBeenCalled();
  });
});
