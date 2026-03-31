import { ProjectGroupService } from '../../src/modules/project-group/project-group.service';
import { ROLES } from '../../src/common/constants/roles.constants';

describe('ProjectGroupService advisor announcements', () => {
  const prisma: any = {
    project: {
      findFirst: jest.fn(),
    },
  };
  const config: any = {};
  const email: any = {};
  const queueService: any = {};
  const cloudinary: any = {};
  const authRepository: any = {
    findUserById: jest.fn(),
  };
  const projectGroupRepository: any = {
    createAnnouncement: jest.fn(),
  };
  const notificationGateway: any = {
    emitEventToUsers: jest.fn(),
  };

  let service: ProjectGroupService;

  beforeEach(() => {
    jest.resetAllMocks();

    service = new ProjectGroupService(
      prisma,
      config,
      email,
      queueService,
      cloudinary,
      authRepository,
      projectGroupRepository,
      notificationGateway
    );

    authRepository.findUserById.mockResolvedValue({
      id: 'advisor-user-1',
      tenantId: 'tenant-1',
      departmentId: 'dept-1',
    });

    prisma.project.findFirst.mockResolvedValue({
      id: 'project-1',
      tenantId: 'tenant-1',
      departmentId: 'dept-1',
      proposal: {
        projectGroup: {
          id: 'group-1',
          status: 'APPROVED',
        },
      },
    });

    projectGroupRepository.createAnnouncement.mockResolvedValue({
      id: 'a1',
      title: 'Meeting',
      message: 'Friday 2PM',
      priority: 'MEDIUM',
      projectGroupId: 'group-1',
      deadlineAt: new Date(Date.now() + 60 * 60 * 1000),
      disableAfterDeadline: true,
      expiredAt: null,
    });
  });

  it('allows advisor to create announcement for supervised project (with deadline)', async () => {
    const result = await service.createAnnouncementForMySupervisedProject(
      { sub: 'advisor-user-1', roles: [ROLES.ADVISOR], tenantId: 'tenant-1' },
      {
        projectId: 'project-1',
        title: 'Meeting',
        message: 'Friday 2PM',
        priority: 'MEDIUM',
        attachmentUrl: undefined,
        deadlineAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        disableAfterDeadline: true,
      } as any
    );

    expect(prisma.project.findFirst).toHaveBeenCalled();
    expect(projectGroupRepository.createAnnouncement).toHaveBeenCalledWith(
      expect.objectContaining({
        projectGroupId: 'group-1',
        title: 'Meeting',
      })
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: 'a1',
        isExpired: false,
        isDisabled: false,
      })
    );
    expect(result.secondsRemaining).toBeGreaterThan(0);
  });

  it('rejects non-advisor roles', async () => {
    await expect(
      service.createAnnouncementForMySupervisedProject(
        { sub: 'student-1', roles: [ROLES.STUDENT], tenantId: 'tenant-1' },
        {
          projectId: 'project-1',
          title: 'Meeting',
          message: 'Friday 2PM',
          priority: 'MEDIUM',
        } as any
      )
    ).rejects.toBeTruthy();
  });
});
