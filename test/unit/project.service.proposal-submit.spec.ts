import { BadRequestException } from '@nestjs/common';
import { ProposalStatus } from '@prisma/client';
import { ProjectService } from '../../src/modules/project/project.service';
import { ROLES } from '../../src/common/constants/roles.constants';

describe('ProjectService.submitProposal', () => {
  const repo: any = {
    findUserForProjectMembership: jest.fn(),
    findGroupLeaderRequestStatus: jest.fn(),
    findApprovedProjectGroupByLeader: jest.fn(),
    findProposalById: jest.fn(),
    updateProposalStatus: jest.fn(),
  };

  const notificationService: any = {
    notifyProposalSubmitted: jest.fn(),
  };

  const cloudinaryService: any = {};

  let service: ProjectService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new ProjectService(repo, notificationService, cloudinaryService);

    repo.findUserForProjectMembership.mockResolvedValue({
      id: 'u1',
      tenantId: 't1',
      departmentId: 'd1',
      status: 'ACTIVE',
    });

    repo.findGroupLeaderRequestStatus.mockResolvedValue({ status: 'APPROVED' });

    repo.findApprovedProjectGroupByLeader.mockResolvedValue({
      id: 'g1',
      status: 'APPROVED',
    });

    // submitProposal -> notifyProposalSubmitted -> listDepartmentProposalReviewerUserIds
    repo.listDepartmentProposalReviewerUserIds = jest.fn().mockResolvedValue([]);
  });

  it('rejects submit when proposal.pdf is missing', async () => {
    repo.findProposalById.mockResolvedValue({
      id: 'p1',
      tenantId: 't1',
      departmentId: 'd1',
      submittedBy: 'u1',
      status: ProposalStatus.DRAFT,
      documents: null,
    });

    await expect(
      service.submitProposal('p1', { sub: 'u1', roles: [ROLES.STUDENT] })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows submit when proposal.pdf exists', async () => {
    repo.findProposalById.mockResolvedValue({
      id: 'p1',
      tenantId: 't1',
      departmentId: 'd1',
      submittedBy: 'u1',
      status: ProposalStatus.DRAFT,
      documents: [{ key: 'proposal.pdf', url: 'https://example.com/proposal.pdf' }],
    });

    repo.updateProposalStatus.mockResolvedValue({ id: 'p1', status: ProposalStatus.SUBMITTED });

    const result = await service.submitProposal('p1', { sub: 'u1', roles: [ROLES.STUDENT] });

    expect(repo.updateProposalStatus).toHaveBeenCalledWith('p1', {
      status: ProposalStatus.SUBMITTED,
      feedback: null,
    });
    expect(result).toEqual({ id: 'p1', status: ProposalStatus.SUBMITTED });
  });
});
