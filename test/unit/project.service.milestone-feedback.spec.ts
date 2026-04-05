import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { ROLES } from '../../src/common/constants/roles.constants';
import { ProjectService } from '../../src/modules/project/project.service';

describe('ProjectService milestone submission feedback', () => {
  const repo: any = {
    findMilestoneSubmissionByIdWithProject: jest.fn(),
    createMilestoneSubmissionFeedback: jest.fn(),
    listMilestoneSubmissionFeedbacks: jest.fn(),
    findProjectMembers: jest.fn(),
    findProjectMember: jest.fn(),
  };

  const notificationService: any = {
    notifyMilestoneFeedbackAdded: jest.fn(),
  };

  const cloudinaryService: any = {
    uploadMilestoneFeedbackAttachment: jest.fn(),
    deleteByPublicId: jest.fn(),
  };

  const projectEmailService: any = {};

  let service: ProjectService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new ProjectService(repo, notificationService, cloudinaryService, projectEmailService);
  });

  const submissionRecord = {
    id: 'submission-1',
    milestoneId: 'milestone-1',
    status: 'SUBMITTED',
    milestone: {
      id: 'milestone-1',
      title: 'Milestone 2',
      project: {
        id: 'project-1',
        title: 'Research Platform',
        tenantId: 'tenant-1',
        departmentId: 'dept-1',
        advisorId: 'advisor-1',
        proposal: {
          projectGroup: {
            id: 'group-1',
            name: 'Team Alpha',
          },
        },
      },
    },
  };

  it('creates feedback and notifies student members', async () => {
    repo.findMilestoneSubmissionByIdWithProject.mockResolvedValue(submissionRecord);
    repo.createMilestoneSubmissionFeedback.mockResolvedValue({ id: 'feedback-1' });
    repo.findProjectMembers.mockResolvedValue({
      id: 'project-1',
      members: [
        { userId: 'student-1', role: 'STUDENT' },
        { userId: 'student-2', role: 'STUDENT' },
        { userId: 'advisor-1', role: 'ADVISOR' },
      ],
    });
    cloudinaryService.uploadMilestoneFeedbackAttachment.mockResolvedValue({
      secureUrl: 'https://files.example.com/review.pdf',
      publicId: 'review-file-1',
      resourceType: 'raw',
    });

    await service.addMilestoneSubmissionFeedback(
      'milestone-1',
      'submission-1',
      { message: 'Please improve the literature review section.' } as any,
      {
        buffer: Buffer.from('x'),
        size: 1,
        mimetype: 'application/pdf',
        originalname: 'review.pdf',
      } as Express.Multer.File,
      { sub: 'advisor-1', roles: [ROLES.ADVISOR], departmentId: 'dept-1' }
    );

    expect(repo.createMilestoneSubmissionFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        submissionId: 'submission-1',
        authorId: 'advisor-1',
        authorRole: ROLES.ADVISOR,
        attachmentUrl: 'https://files.example.com/review.pdf',
      })
    );

    expect(notificationService.notifyMilestoneFeedbackAdded).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        projectId: 'project-1',
        milestoneId: 'milestone-1',
        submissionId: 'submission-1',
        userIds: ['student-1', 'student-2'],
        actorUserId: 'advisor-1',
        actorRole: ROLES.ADVISOR,
        hasAttachment: true,
      })
    );
  });

  it('rejects feedback from a different advisor assigned to another project', async () => {
    repo.findMilestoneSubmissionByIdWithProject.mockResolvedValue(submissionRecord);

    await expect(
      service.addMilestoneSubmissionFeedback(
        'milestone-1',
        'submission-1',
        { message: 'Revise this section.' } as any,
        undefined,
        { sub: 'advisor-2', roles: [ROLES.ADVISOR], departmentId: 'dept-1' }
      )
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects feedback on an approved submission', async () => {
    repo.findMilestoneSubmissionByIdWithProject.mockResolvedValue({
      ...submissionRecord,
      status: 'APPROVED',
    });

    await expect(
      service.addMilestoneSubmissionFeedback(
        'milestone-1',
        'submission-1',
        { message: 'Late feedback' } as any,
        undefined,
        { sub: 'advisor-1', roles: [ROLES.ADVISOR], departmentId: 'dept-1' }
      )
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('allows project student members to read feedback history', async () => {
    repo.findMilestoneSubmissionByIdWithProject.mockResolvedValue(submissionRecord);
    repo.findProjectMember.mockResolvedValue({ id: 'member-1', projectId: 'project-1', userId: 'student-1' });
    repo.listMilestoneSubmissionFeedbacks.mockResolvedValue([{ id: 'feedback-1' }]);

    const result = await service.listMilestoneSubmissionFeedbacks(
      'milestone-1',
      'submission-1',
      { sub: 'student-1', roles: [ROLES.STUDENT], departmentId: 'other-dept' }
    );

    expect(result).toEqual([{ id: 'feedback-1' }]);
  });

  it('throws when submission does not exist', async () => {
    repo.findMilestoneSubmissionByIdWithProject.mockResolvedValue(null);

    await expect(
      service.listMilestoneSubmissionFeedbacks('milestone-1', 'missing', {
        sub: 'student-1',
        roles: [ROLES.STUDENT],
      })
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});