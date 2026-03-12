import {
  StudentProfileCompletionReminderScheduler,
  StudentProfileCompletionReminder,
} from '../../src/modules/student-profile/student-profile-completion-reminder.scheduler';

describe('StudentProfileCompletionReminderScheduler', () => {
  const prisma: any = {
    user: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const config: any = {
    get: jest.fn(),
  };

  const queue: any = {
    addTransactionalTemplateEmailJob: jest.fn(),
  };

  const emailService: any = {
    getCommonTemplateParams: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();
    delete process.env.DYNO;
    delete process.env.WORKER;

    emailService.getCommonTemplateParams.mockReturnValue({
      appName: 'Academia',
      logoUrl: 'https://example.com/logo.png',
      supportEmail: 'support@x.com',
      currentYear: 2026,
    });

    config.get.mockImplementation((key: string) => {
      if (key === 'email.studentProfileCompletionReminderTemplateId') return 999;
      if (key === 'app.frontendUrl') return 'http://localhost:3000';
      return undefined;
    });
  });

  it('exports correct completeness rule (bio + techStack + any social link)', () => {
    expect(
      StudentProfileCompletionReminder.isStudentProfileComplete({
        bio: 'Hi',
        techStack: ['NestJS'],
        githubUrl: 'https://github.com/x',
        linkedinUrl: null,
        portfolioUrl: null,
      })
    ).toBe(true);

    expect(
      StudentProfileCompletionReminder.isStudentProfileComplete({
        bio: 'Hi',
        techStack: [],
        githubUrl: 'https://github.com/x',
      })
    ).toBe(false);

    expect(
      StudentProfileCompletionReminder.isStudentProfileComplete({
        bio: '',
        techStack: ['NestJS'],
        githubUrl: 'https://github.com/x',
      })
    ).toBe(false);

    expect(
      StudentProfileCompletionReminder.isStudentProfileComplete({
        bio: 'Hi',
        techStack: ['NestJS'],
        githubUrl: null,
        linkedinUrl: null,
        portfolioUrl: null,
      })
    ).toBe(false);
  });

  it('enqueues reminder once for incomplete student profile', async () => {
    prisma.user.findMany
      .mockResolvedValueOnce([
        {
          id: 'u1',
          email: 's@x.com',
          firstName: 'Student',
          lastName: 'One',
          tenantId: 't1',
          student: {
            bio: null,
            githubUrl: null,
            linkedinUrl: null,
            portfolioUrl: null,
            techStack: [],
          },
        },
      ])
      .mockResolvedValueOnce([]);

    prisma.user.updateMany.mockResolvedValue({ count: 1 });

    const scheduler = new StudentProfileCompletionReminderScheduler(
      prisma,
      config,
      queue,
      emailService
    );

    await scheduler.handleStudentProfileCompletionReminders();

    expect(prisma.user.updateMany).toHaveBeenCalled();
    expect(queue.addTransactionalTemplateEmailJob).toHaveBeenCalledWith(
      expect.objectContaining({
        templateId: 999,
        to: { email: 's@x.com', name: 'Student One' },
        params: expect.objectContaining({
          recipientName: 'Student One',
          profileUrl: 'http://localhost:3000/dashboard/profile',
        }),
      })
    );
  });

  it('does not enqueue when profile is already complete', async () => {
    prisma.user.findMany
      .mockResolvedValueOnce([
        {
          id: 'u1',
          email: 's@x.com',
          firstName: 'Student',
          lastName: 'One',
          tenantId: 't1',
          student: {
            bio: 'Hi',
            githubUrl: 'https://github.com/x',
            linkedinUrl: null,
            portfolioUrl: null,
            techStack: ['NestJS'],
          },
        },
      ])
      .mockResolvedValueOnce([]);

    const scheduler = new StudentProfileCompletionReminderScheduler(
      prisma,
      config,
      queue,
      emailService
    );

    await scheduler.handleStudentProfileCompletionReminders();

    expect(prisma.user.updateMany).not.toHaveBeenCalled();
    expect(queue.addTransactionalTemplateEmailJob).not.toHaveBeenCalled();
  });

  it('skips entirely when templateId is not configured', async () => {
    config.get.mockImplementation((key: string) => {
      if (key === 'email.studentProfileCompletionReminderTemplateId') return undefined;
      if (key === 'app.frontendUrl') return 'http://localhost:3000';
      return undefined;
    });

    const scheduler = new StudentProfileCompletionReminderScheduler(
      prisma,
      config,
      queue,
      emailService
    );

    await scheduler.handleStudentProfileCompletionReminders();

    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(queue.addTransactionalTemplateEmailJob).not.toHaveBeenCalled();
  });
});
