import { ConflictException, ForbiddenException } from '@nestjs/common';
import { ProposalStatus } from '@prisma/client';
import { ProjectService } from '../../src/modules/project/project.service';
import { ROLES } from '../../src/common/constants/roles.constants';

describe('ProjectService proposal feedback timeline', () => {
  const repo: any = {
    findProposalById: jest.fn(),
    findUserForProjectMembership: jest.fn(),
    createProposalFeedback: jest.fn(),
    listProposalFeedbacks: jest.fn(),
  };

  const notificationService: any = {};
  const cloudinaryService: any = {};

  let service: ProjectService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new ProjectService(repo, notificationService, cloudinaryService);

    repo.findUserForProjectMembership.mockResolvedValue({
      id: 'reviewer-1',
      tenantId: 't1',
      departmentId: 'd1',
      status: 'ACTIVE',
    });
  });

  describe('addProposalFeedback', () => {
    it('forbids non-reviewers', async () => {
      repo.findProposalById.mockResolvedValue({
        id: 'p1',
        tenantId: 't1',
        departmentId: 'd1',
        submittedBy: 'student-1',
        status: ProposalStatus.SUBMITTED,
      });

      await expect(
        service.addProposalFeedback(
          'p1',
          { message: 'hello' } as any,
          { sub: 'x1', roles: [ROLES.STUDENT], departmentId: 'd1' }
        )
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects feedback when proposal is not SUBMITTED', async () => {
      repo.findProposalById.mockResolvedValue({
        id: 'p1',
        tenantId: 't1',
        departmentId: 'd1',
        submittedBy: 'student-1',
        status: ProposalStatus.DRAFT,
      });

      await expect(
        service.addProposalFeedback(
          'p1',
          { message: 'hello' } as any,
          { sub: 'a1', roles: [ROLES.ADVISOR], departmentId: 'd1' }
        )
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('creates feedback for reviewers while SUBMITTED', async () => {
      repo.findProposalById.mockResolvedValue({
        id: 'p1',
        tenantId: 't1',
        departmentId: 'd1',
        submittedBy: 'student-1',
        status: ProposalStatus.SUBMITTED,
      });

      repo.createProposalFeedback.mockResolvedValue({
        id: 'f1',
        proposalId: 'p1',
        authorId: 'a1',
        authorRole: ROLES.ADVISOR,
        message: 'Please improve the scope.',
      });

      const result = await service.addProposalFeedback(
        'p1',
        { message: 'Please improve the scope.' } as any,
        { sub: 'a1', roles: [ROLES.ADVISOR], departmentId: 'd1' }
      );

      expect(repo.createProposalFeedback).toHaveBeenCalledWith({
        proposalId: 'p1',
        authorId: 'a1',
        authorRole: ROLES.ADVISOR,
        message: 'Please improve the scope.',
      });

      expect(result).toEqual({
        id: 'f1',
        proposalId: 'p1',
        authorId: 'a1',
        authorRole: ROLES.ADVISOR,
        message: 'Please improve the scope.',
      });
    });
  });

  describe('listProposalFeedbacks', () => {
    it('allows submitter student to list feedback', async () => {
      repo.findProposalById.mockResolvedValue({
        id: 'p1',
        tenantId: 't1',
        departmentId: 'd1',
        submittedBy: 'student-1',
        status: ProposalStatus.SUBMITTED,
      });

      repo.listProposalFeedbacks.mockResolvedValue([{ id: 'f1' }]);

      const result = await service.listProposalFeedbacks('p1', {
        sub: 'student-1',
        roles: [ROLES.STUDENT],
        departmentId: 'd1',
      });

      expect(repo.listProposalFeedbacks).toHaveBeenCalledWith('p1');
      expect(result).toEqual([{ id: 'f1' }]);
    });

    it('forbids other students from listing feedback', async () => {
      repo.findProposalById.mockResolvedValue({
        id: 'p1',
        tenantId: 't1',
        departmentId: 'd1',
        submittedBy: 'student-1',
        status: ProposalStatus.SUBMITTED,
      });

      await expect(
        service.listProposalFeedbacks('p1', {
          sub: 'student-2',
          roles: [ROLES.STUDENT],
          departmentId: 'd1',
        })
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
