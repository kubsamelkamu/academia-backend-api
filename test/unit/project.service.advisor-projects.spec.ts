import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { ROLES } from '../../src/common/constants/roles.constants';
import { ProjectService } from '../../src/modules/project/project.service';

describe('ProjectService.listAdvisorProjects', () => {
  const projectRepository: any = {
    findAdvisorById: jest.fn(),
    listAdvisorProjectsDetailed: jest.fn(),
  };

  const notificationService: any = {};
  const cloudinaryService: any = {};
  const projectEmailService: any = {};

  let service: ProjectService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new ProjectService(
      projectRepository,
      notificationService,
      cloudinaryService,
      projectEmailService
    );
  });

  it('returns advisor projects for department staff with access', async () => {
    projectRepository.findAdvisorById.mockResolvedValue({
      id: 'advisor-profile-1',
      userId: 'advisor-user-1',
      departmentId: 'dept-1',
    });

    projectRepository.listAdvisorProjectsDetailed.mockResolvedValue([
      {
        id: 'project-1',
        title: 'Project A',
        status: 'ACTIVE',
        startedAt: new Date('2026-03-20T09:00:00.000Z'),
        group: { id: 'group-1', name: 'Team Alpha', studentCount: 4 },
        milestones: { total: 5, completed: 2, progressPercent: 40 },
      },
    ]);

    const result = await service.listAdvisorProjects('advisor-profile-1', {
      sub: 'coordinator-1',
      roles: [ROLES.COORDINATOR],
      departmentId: 'dept-1',
    });

    expect(projectRepository.listAdvisorProjectsDetailed).toHaveBeenCalledWith('advisor-user-1');
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].title).toBe('Project A');
  });

  it('allows an advisor to fetch their own assigned projects', async () => {
    projectRepository.findAdvisorById.mockResolvedValue({
      id: 'advisor-profile-1',
      userId: 'advisor-user-1',
      departmentId: 'dept-1',
    });

    projectRepository.listAdvisorProjectsDetailed.mockResolvedValue([]);

    await service.listAdvisorProjects('advisor-profile-1', {
      sub: 'advisor-user-1',
      roles: [ROLES.ADVISOR],
      departmentId: 'other-dept',
    });

    expect(projectRepository.listAdvisorProjectsDetailed).toHaveBeenCalledWith('advisor-user-1');
  });

  it('rejects users without department access who are not the advisor', async () => {
    projectRepository.findAdvisorById.mockResolvedValue({
      id: 'advisor-profile-1',
      userId: 'advisor-user-1',
      departmentId: 'dept-1',
    });

    await expect(
      service.listAdvisorProjects('advisor-profile-1', {
        sub: 'advisor-user-2',
        roles: [ROLES.ADVISOR],
        departmentId: 'dept-2',
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws not found when advisor does not exist', async () => {
    projectRepository.findAdvisorById.mockResolvedValue(null);

    await expect(
      service.listAdvisorProjects('missing-advisor', {
        sub: 'coordinator-1',
        roles: [ROLES.COORDINATOR],
        departmentId: 'dept-1',
      })
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
