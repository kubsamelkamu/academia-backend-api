import { ProjectGroupService } from '../../src/modules/project-group/project-group.service';
import { ROLES } from '../../src/common/constants/roles.constants';

describe('ProjectGroupService announcement countdown fields', () => {
  const prisma: any = {};
  const config: any = {};
  const email: any = {};
  const queueService: any = {};
  const cloudinary: any = {};
  const authRepository: any = {
    findUserById: jest.fn(),
  };
  const projectGroupRepository: any = {
    findMyGroupBasicForStudent: jest.fn(),
    listAnnouncementsPaged: jest.fn(),
    findAnnouncementForGroup: jest.fn(),
  };
  const notificationGateway: any = {};
  const notificationService: any = {
    notifyProjectGroupFormed: jest.fn(),
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
      notificationGateway,
      notificationService
    );

    authRepository.findUserById.mockResolvedValue({
      id: 'student-1',
      tenantId: 'tenant-1',
      departmentId: 'dept-1',
    });

    projectGroupRepository.findMyGroupBasicForStudent.mockResolvedValue({
      id: 'group-1',
      status: 'APPROVED',
    });
  });

  it('adds countdown metadata to group announcement lists', async () => {
    const futureDeadline = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const pastDeadline = new Date(Date.now() - 10 * 60 * 1000);

    projectGroupRepository.listAnnouncementsPaged.mockResolvedValue({
      items: [
        {
          id: 'a1',
          title: 'Active reminder',
          deadlineAt: futureDeadline,
          disableAfterDeadline: true,
          expiredAt: null,
        },
        {
          id: 'a2',
          title: 'Expired reminder',
          deadlineAt: pastDeadline,
          disableAfterDeadline: true,
          expiredAt: null,
        },
        {
          id: 'a3',
          title: 'General note',
          deadlineAt: null,
          disableAfterDeadline: true,
          expiredAt: null,
        },
      ],
      total: 3,
    });

    const result = await service.listAnnouncementsForMyGroup(
      { sub: 'student-1', roles: [ROLES.STUDENT], tenantId: 'tenant-1' },
      {} as any
    );

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        id: 'a1',
        isExpired: false,
        isDisabled: false,
      })
    );
    expect(result.items[0].secondsRemaining).toBeGreaterThan(0);

    expect(result.items[1]).toEqual(
      expect.objectContaining({
        id: 'a2',
        isExpired: true,
        isDisabled: true,
        secondsRemaining: 0,
      })
    );

    expect(result.items[2]).toEqual(
      expect.objectContaining({
        id: 'a3',
        isExpired: false,
        isDisabled: false,
        secondsRemaining: null,
      })
    );
  });

  it('adds countdown metadata to a single group announcement response', async () => {
    const futureDeadline = new Date(Date.now() + 30 * 60 * 1000);

    projectGroupRepository.findAnnouncementForGroup.mockResolvedValue({
      id: 'a1',
      title: 'Single reminder',
      deadlineAt: futureDeadline,
      disableAfterDeadline: true,
      expiredAt: null,
    });

    const result = await service.getAnnouncementForMyGroup(
      { sub: 'student-1', roles: [ROLES.STUDENT], tenantId: 'tenant-1' },
      'a1'
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
});
