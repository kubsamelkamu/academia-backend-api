import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { ROLES } from '../../src/common/constants/roles.constants';
import { ProjectService } from '../../src/modules/project/project.service';

describe('ProjectService advisor submitted documents', () => {
  const projectRepository: any = {
    findAdvisorById: jest.fn(),
    findAdvisorByUserId: jest.fn(),
    listAdvisorSubmittedDocuments: jest.fn(),
  };

  let service: ProjectService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new ProjectService(projectRepository, {} as any, {} as any, {} as any);
  });

  it('returns my advisor submitted documents dashboard', async () => {
    projectRepository.findAdvisorByUserId.mockResolvedValue({
      id: 'advisor-profile-1',
      userId: 'advisor-user-1',
      departmentId: 'dept-1',
    });
    projectRepository.listAdvisorSubmittedDocuments.mockResolvedValue({
      summary: { totalSubmittedDocuments: 1, approved: 0, pendingReview: 1, revisionRequested: 0 },
      documents: [{ submissionId: 'submission-1' }],
    });

    const result = await service.listMyAdvisorSubmittedDocuments({
      sub: 'advisor-user-1',
      roles: [ROLES.ADVISOR],
      departmentId: 'dept-1',
    });

    expect(projectRepository.listAdvisorSubmittedDocuments).toHaveBeenCalledWith('advisor-user-1');
    expect(result.summary.totalSubmittedDocuments).toBe(1);
  });

  it('allows department staff to view an advisor submitted documents dashboard', async () => {
    projectRepository.findAdvisorById.mockResolvedValue({
      id: 'advisor-profile-1',
      userId: 'advisor-user-1',
      departmentId: 'dept-1',
    });
    projectRepository.listAdvisorSubmittedDocuments.mockResolvedValue({
      summary: { totalSubmittedDocuments: 0, approved: 0, pendingReview: 0, revisionRequested: 0 },
      documents: [],
    });

    await service.listAdvisorSubmittedDocuments('advisor-profile-1', {
      sub: 'coordinator-1',
      roles: [ROLES.COORDINATOR],
      departmentId: 'dept-1',
    });

    expect(projectRepository.listAdvisorSubmittedDocuments).toHaveBeenCalledWith('advisor-user-1');
  });

  it('rejects unrelated users', async () => {
    projectRepository.findAdvisorById.mockResolvedValue({
      id: 'advisor-profile-1',
      userId: 'advisor-user-1',
      departmentId: 'dept-1',
    });

    await expect(
      service.listAdvisorSubmittedDocuments('advisor-profile-1', {
        sub: 'advisor-user-2',
        roles: [ROLES.ADVISOR],
        departmentId: 'dept-2',
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws when advisor profile is missing for me endpoint', async () => {
    projectRepository.findAdvisorByUserId.mockResolvedValue(null);

    await expect(
      service.listMyAdvisorSubmittedDocuments({
        sub: 'advisor-user-1',
        roles: [ROLES.ADVISOR],
      })
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
