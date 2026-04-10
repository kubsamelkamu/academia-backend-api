import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { ROLES } from '../../src/common/constants/roles.constants';
import { ProjectService } from '../../src/modules/project/project.service';

describe('ProjectService.getAdvisorSummary', () => {
  const projectRepository: any = {
    findAdvisorById: jest.fn(),
    getAdvisorSummary: jest.fn(),
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

  it('returns advisor summary for department staff with access', async () => {
    projectRepository.findAdvisorById.mockResolvedValue({
      id: 'advisor-profile-1',
      userId: 'advisor-user-1',
      departmentId: 'dept-1',
    });

    projectRepository.getAdvisorSummary.mockResolvedValue({
      advisor: {
        id: 'advisor-user-1',
        advisorProfileId: 'advisor-profile-1',
        firstName: 'Alem',
        lastName: 'Bekele',
        fullName: 'Alem Bekele',
        email: 'alem@example.com',
        avatarUrl: 'https://example.com/avatar.png',
      },
      metrics: {
        totalProjectsAdvising: 2,
        totalGroupsAdvising: 2,
        totalStudentsAdvising: 7,
      },
      projects: [
        {
          id: 'project-1',
          title: 'Smart Campus Navigation',
          status: 'ACTIVE',
          startedAt: new Date('2026-03-20T09:00:00.000Z'),
          proposal: { id: 'proposal-1', title: 'Smart Campus Navigation' },
          group: {
            id: 'group-1',
            name: 'Team Alpha',
            status: 'APPROVED',
            leader: {
              id: 'student-1',
              firstName: 'Sara',
              lastName: 'Ali',
              email: 'sara@example.com',
              avatarUrl: 'https://example.com/sara.png',
            },
            members: [],
            studentCount: 4,
          },
        },
      ],
    });

    const result = await service.getAdvisorSummary('advisor-profile-1', {
      sub: 'coordinator-1',
      roles: [ROLES.COORDINATOR],
      departmentId: 'dept-1',
    });

    expect(projectRepository.getAdvisorSummary).toHaveBeenCalledWith('advisor-profile-1');
    if (!result) {
      throw new Error('Expected advisor summary to be returned');
    }
    expect(result.metrics.totalStudentsAdvising).toBe(7);
    expect(result.projects[0].group?.name).toBe('Team Alpha');
  });

  it('allows an advisor to fetch their own summary', async () => {
    projectRepository.findAdvisorById.mockResolvedValue({
      id: 'advisor-profile-1',
      userId: 'advisor-user-1',
      departmentId: 'dept-1',
    });
    projectRepository.getAdvisorSummary.mockResolvedValue({ advisor: {}, metrics: {}, projects: [] });

    await service.getAdvisorSummary('advisor-profile-1', {
      sub: 'advisor-user-1',
      roles: [ROLES.ADVISOR],
      departmentId: 'other-dept',
    });

    expect(projectRepository.getAdvisorSummary).toHaveBeenCalledWith('advisor-profile-1');
  });

  it('rejects users without department access who are not the advisor', async () => {
    projectRepository.findAdvisorById.mockResolvedValue({
      id: 'advisor-profile-1',
      userId: 'advisor-user-1',
      departmentId: 'dept-1',
    });

    await expect(
      service.getAdvisorSummary('advisor-profile-1', {
        sub: 'advisor-user-2',
        roles: [ROLES.ADVISOR],
        departmentId: 'dept-2',
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws not found when advisor does not exist', async () => {
    projectRepository.findAdvisorById.mockResolvedValue(null);

    await expect(
      service.getAdvisorSummary('missing-advisor', {
        sub: 'coordinator-1',
        roles: [ROLES.COORDINATOR],
        departmentId: 'dept-1',
      })
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});