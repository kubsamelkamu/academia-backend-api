import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { ROLES } from '../../src/common/constants/roles.constants';
import { ProjectService } from '../../src/modules/project/project.service';

describe('ProjectService advisor milestone review queue', () => {
  const projectRepository: any = {
    findAdvisorById: jest.fn(),
    findAdvisorByUserId: jest.fn(),
    listAdvisorMilestoneReviewQueue: jest.fn(),
  };

  let service: ProjectService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new ProjectService(projectRepository, {} as any, {} as any, {} as any);
  });

  it('returns my advisor review queue', async () => {
    projectRepository.findAdvisorByUserId.mockResolvedValue({
      id: 'advisor-profile-1',
      userId: 'advisor-user-1',
      departmentId: 'dept-1',
    });
    projectRepository.listAdvisorMilestoneReviewQueue.mockResolvedValue([{ milestone: { id: 'm1' } }]);

    const result = await service.listMyAdvisorMilestoneReviewQueue({
      sub: 'advisor-user-1',
      roles: [ROLES.ADVISOR],
      departmentId: 'dept-1',
    });

    expect(projectRepository.listAdvisorMilestoneReviewQueue).toHaveBeenCalledWith('advisor-user-1');
    expect(result).toEqual([{ milestone: { id: 'm1' } }]);
  });

  it('allows department staff to view an advisor review queue', async () => {
    projectRepository.findAdvisorById.mockResolvedValue({
      id: 'advisor-profile-1',
      userId: 'advisor-user-1',
      departmentId: 'dept-1',
    });
    projectRepository.listAdvisorMilestoneReviewQueue.mockResolvedValue([]);

    await service.listAdvisorMilestoneReviewQueue('advisor-profile-1', {
      sub: 'coordinator-1',
      roles: [ROLES.COORDINATOR],
      departmentId: 'dept-1',
    });

    expect(projectRepository.listAdvisorMilestoneReviewQueue).toHaveBeenCalledWith('advisor-user-1');
  });

  it('rejects unrelated users', async () => {
    projectRepository.findAdvisorById.mockResolvedValue({
      id: 'advisor-profile-1',
      userId: 'advisor-user-1',
      departmentId: 'dept-1',
    });

    await expect(
      service.listAdvisorMilestoneReviewQueue('advisor-profile-1', {
        sub: 'advisor-user-2',
        roles: [ROLES.ADVISOR],
        departmentId: 'dept-2',
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws when advisor profile is missing', async () => {
    projectRepository.findAdvisorByUserId.mockResolvedValue(null);

    await expect(
      service.listMyAdvisorMilestoneReviewQueue({
        sub: 'advisor-user-1',
        roles: [ROLES.ADVISOR],
      })
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});