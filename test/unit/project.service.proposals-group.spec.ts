import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ProjectService } from '../../src/modules/project/project.service';
import { ROLES } from '../../src/common/constants/roles.constants';

describe('ProjectService group proposal access', () => {
  const repo: any = {
    findUserForProjectMembership: jest.fn(),
    listApprovedGroupMemberUserIdsForStudent: jest.fn(),
    findProposalsByProjectGroupId: jest.fn(),
    findProposalById: jest.fn(),
    listProposalFeedbacks: jest.fn(),
  };

  const notificationService: any = {};
  const cloudinaryService: any = {};
  const projectEmailService: any = {};

  let service: ProjectService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new ProjectService(repo, notificationService, cloudinaryService, projectEmailService);

    repo.findUserForProjectMembership.mockResolvedValue({
      id: 'u2',
      tenantId: 't1',
      departmentId: 'd1',
      status: 'ACTIVE',
    });
  });

  it('lists proposals for the student approved group (any member)', async () => {
    repo.listApprovedGroupMemberUserIdsForStudent.mockResolvedValue({
      projectGroupId: 'g1',
      memberUserIds: ['u1', 'u2'],
    });

    repo.findProposalsByProjectGroupId.mockResolvedValue([{ id: 'p1' }]);

    const res = await service.listGroupProposals({ sub: 'u2', roles: [ROLES.STUDENT] });

    expect(repo.findProposalsByProjectGroupId).toHaveBeenCalledWith({
      tenantId: 't1',
      projectGroupId: 'g1',
    });
    expect(res).toEqual([{ id: 'p1' }]);
  });

  it('rejects group proposals listing if student has no approved group', async () => {
    repo.listApprovedGroupMemberUserIdsForStudent.mockResolvedValue({
      projectGroupId: null,
      memberUserIds: [],
    });

    await expect(
      service.listGroupProposals({ sub: 'u2', roles: [ROLES.STUDENT] })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows student to view proposal details if they are in the same approved project group', async () => {
    repo.findProposalById.mockResolvedValue({
      id: 'p1',
      tenantId: 't1',
      departmentId: 'd1',
      submittedBy: 'u1',
      projectGroupId: 'g1',
    });

    repo.listApprovedGroupMemberUserIdsForStudent.mockResolvedValue({
      projectGroupId: 'g1',
      memberUserIds: ['u1', 'u2'],
    });

    const res = await service.getProposalById('p1', { sub: 'u2', roles: [ROLES.STUDENT] });
    expect(res).toEqual({
      id: 'p1',
      tenantId: 't1',
      departmentId: 'd1',
      submittedBy: 'u1',
      projectGroupId: 'g1',
    });
  });

  it('forbids student from viewing proposal details if not submitter and not in proposal group', async () => {
    repo.findProposalById.mockResolvedValue({
      id: 'p1',
      tenantId: 't1',
      departmentId: 'd1',
      submittedBy: 'u1',
      projectGroupId: 'g1',
    });

    repo.listApprovedGroupMemberUserIdsForStudent.mockResolvedValue({
      projectGroupId: 'g2',
      memberUserIds: ['u2'],
    });

    await expect(
      service.getProposalById('p1', { sub: 'u2', roles: [ROLES.STUDENT] })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows student to view feedback timeline for proposals in their approved group', async () => {
    repo.findProposalById.mockResolvedValue({
      id: 'p1',
      tenantId: 't1',
      departmentId: 'd1',
      submittedBy: 'u1',
      projectGroupId: 'g1',
    });

    repo.listApprovedGroupMemberUserIdsForStudent.mockResolvedValue({
      projectGroupId: 'g1',
      memberUserIds: ['u1', 'u2'],
    });

    repo.listProposalFeedbacks.mockResolvedValue([{ id: 'f1' }]);

    const res = await service.listProposalFeedbacks('p1', { sub: 'u2', roles: [ROLES.STUDENT] });
    expect(res).toEqual([{ id: 'f1' }]);
  });
});
