import { ConflictException, ForbiddenException } from '@nestjs/common';
import { ProposalStatus } from '@prisma/client';
import { ProjectService } from '../../src/modules/project/project.service';
import { ROLES } from '../../src/common/constants/roles.constants';

describe('ProjectService proposal title votes', () => {
  const repo: any = {
    findProposalById: jest.fn(),
    findUserForProjectMembership: jest.fn(),
    upsertProposalTitleVote: jest.fn(),
    listProposalTitleVotes: jest.fn(),
  };

  const notificationService: any = {};
  const cloudinaryService: any = {};
  const projectEmailService: any = {};

  let service: ProjectService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new ProjectService(repo, notificationService, cloudinaryService, projectEmailService);

    repo.findUserForProjectMembership.mockResolvedValue({
      id: 'reviewer-1',
      tenantId: 't1',
      departmentId: 'd1',
      status: 'ACTIVE',
    });
  });

  describe('voteProposalTitle', () => {
    it('forbids non-reviewers', async () => {
      repo.findProposalById.mockResolvedValue({
        id: 'p1',
        tenantId: 't1',
        departmentId: 'd1',
        submittedBy: 'student-1',
        status: ProposalStatus.SUBMITTED,
        proposedTitles: ['A', 'B', 'C'],
      });

      await expect(
        service.voteProposalTitle(
          'p1',
          { titleIndex: 1 } as any,
          { sub: 's1', roles: [ROLES.STUDENT], departmentId: 'd1' }
        )
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects voting when proposal is not SUBMITTED', async () => {
      repo.findProposalById.mockResolvedValue({
        id: 'p1',
        tenantId: 't1',
        departmentId: 'd1',
        submittedBy: 'student-1',
        status: ProposalStatus.DRAFT,
        proposedTitles: ['A', 'B', 'C'],
      });

      await expect(
        service.voteProposalTitle(
          'p1',
          { titleIndex: 1 } as any,
          { sub: 'a1', roles: [ROLES.ADVISOR], departmentId: 'd1' }
        )
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('upserts a vote for reviewers while SUBMITTED', async () => {
      repo.findProposalById.mockResolvedValue({
        id: 'p1',
        tenantId: 't1',
        departmentId: 'd1',
        submittedBy: 'student-1',
        status: ProposalStatus.SUBMITTED,
        proposedTitles: ['A', 'B', 'C'],
      });

      repo.upsertProposalTitleVote.mockResolvedValue({
        id: 'v1',
        proposalId: 'p1',
        voterId: 'a1',
        voterRole: ROLES.ADVISOR,
        titleIndex: 2,
      });

      const res = await service.voteProposalTitle(
        'p1',
        { titleIndex: 2 } as any,
        { sub: 'a1', roles: [ROLES.ADVISOR], departmentId: 'd1' }
      );

      expect(repo.upsertProposalTitleVote).toHaveBeenCalledWith({
        proposalId: 'p1',
        voterId: 'a1',
        voterRole: ROLES.ADVISOR,
        titleIndex: 2,
      });

      expect(res).toEqual({
        id: 'v1',
        proposalId: 'p1',
        voterId: 'a1',
        voterRole: ROLES.ADVISOR,
        titleIndex: 2,
      });
    });
  });

  describe('getProposalTitleVotes', () => {
    it('returns counts + votes for coordinator', async () => {
      repo.findProposalById.mockResolvedValue({
        id: 'p1',
        tenantId: 't1',
        departmentId: 'd1',
        status: ProposalStatus.SUBMITTED,
      });

      repo.listProposalTitleVotes.mockResolvedValue([
        { id: 'v1', titleIndex: 0 },
        { id: 'v2', titleIndex: 1 },
        { id: 'v3', titleIndex: 1 },
      ]);

      const res = await service.getProposalTitleVotes('p1', {
        sub: 'c1',
        roles: [ROLES.COORDINATOR],
        departmentId: 'd1',
      });

      expect(repo.listProposalTitleVotes).toHaveBeenCalledWith('p1');
      expect(res).toEqual({
        proposalId: 'p1',
        counts: { 0: 1, 1: 2, 2: 0 },
        votes: [{ id: 'v1', titleIndex: 0 }, { id: 'v2', titleIndex: 1 }, { id: 'v3', titleIndex: 1 }],
      });
    });

    it('forbids advisor from viewing votes list', async () => {
      repo.findProposalById.mockResolvedValue({
        id: 'p1',
        tenantId: 't1',
        departmentId: 'd1',
        status: ProposalStatus.SUBMITTED,
      });

      await expect(
        service.getProposalTitleVotes('p1', {
          sub: 'a1',
          roles: [ROLES.ADVISOR],
          departmentId: 'd1',
        })
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
