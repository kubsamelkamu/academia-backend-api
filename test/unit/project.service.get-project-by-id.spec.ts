import { ForbiddenException } from '@nestjs/common';
import { ProjectService } from '../../src/modules/project/project.service';
import { ROLES } from '../../src/common/constants/roles.constants';

describe('ProjectService.getProjectById', () => {
  const repo: any = {
    findProjectById: jest.fn(),
  };

  const notificationService: any = {};
  const cloudinaryService: any = {};
  const projectEmailService: any = {};

  let service: ProjectService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new ProjectService(repo, notificationService, cloudinaryService, projectEmailService);
  });

  it('returns latest submission and final approved file details for each milestone', async () => {
    repo.findProjectById.mockResolvedValue({
      id: 'project-1',
      departmentId: 'dept-1',
      members: [{ userId: 'student-1' }],
      milestones: [
        {
          id: 'milestone-1',
          projectId: 'project-1',
          title: 'SRS',
          description: 'Submit SRS',
          dueDate: new Date('2026-06-14T07:48:04.055Z'),
          status: 'APPROVED',
          submittedAt: new Date('2026-05-10T10:00:00.000Z'),
          feedback: null,
          createdAt: new Date('2026-04-05T07:48:04.076Z'),
          updatedAt: new Date('2026-05-11T09:00:00.000Z'),
          submissions: [
            {
              id: 'submission-2',
              milestoneId: 'milestone-1',
              status: 'APPROVED',
              fileName: 'srs-v2.pdf',
              mimeType: 'application/pdf',
              sizeBytes: 1024,
              fileUrl: 'https://files/srs-v2.pdf',
              filePublicId: 'files/srs-v2',
              resourceType: 'raw',
              createdAt: new Date('2026-05-10T10:00:00.000Z'),
              approvedAt: new Date('2026-05-11T09:00:00.000Z'),
              uploadedBy: { id: 'student-1', firstName: 'Yonas' },
              approvedBy: { id: 'advisor-1', firstName: 'Advisor' },
              feedbacks: [],
            },
            {
              id: 'submission-1',
              milestoneId: 'milestone-1',
              status: 'SUBMITTED',
              fileName: 'srs-v1.pdf',
              mimeType: 'application/pdf',
              sizeBytes: 1000,
              fileUrl: 'https://files/srs-v1.pdf',
              filePublicId: 'files/srs-v1',
              resourceType: 'raw',
              createdAt: new Date('2026-05-01T10:00:00.000Z'),
              approvedAt: null,
              uploadedBy: { id: 'student-1', firstName: 'Yonas' },
              approvedBy: null,
              feedbacks: [
                {
                  id: 'feedback-1',
                  message: 'Revise section 2',
                },
              ],
            },
          ],
        },
      ],
    });

    const result = await service.getProjectById('project-1', {
      sub: 'student-1',
      departmentId: 'dept-1',
      roles: [ROLES.STUDENT],
    });

    expect(result.milestones).toEqual([
      expect.objectContaining({
        id: 'milestone-1',
        latestSubmission: expect.objectContaining({
          id: 'submission-2',
          approvedAt: new Date('2026-05-11T09:00:00.000Z'),
          approvedBy: { id: 'advisor-1', firstName: 'Advisor' },
        }),
        finalApprovedFile: {
          submissionId: 'submission-2',
          url: 'https://files/srs-v2.pdf',
          publicId: 'files/srs-v2',
          fileName: 'srs-v2.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1024,
          resourceType: 'raw',
          approvedAt: new Date('2026-05-11T09:00:00.000Z'),
          approvedBy: { id: 'advisor-1', firstName: 'Advisor' },
        },
        completedAt: new Date('2026-05-11T09:00:00.000Z'),
      }),
    ]);
  });

  it('forbids students who are not project members', async () => {
    repo.findProjectById.mockResolvedValue({
      id: 'project-1',
      departmentId: 'dept-1',
      members: [{ userId: 'student-1' }],
      milestones: [],
    });

    await expect(
      service.getProjectById('project-1', {
        sub: 'student-2',
        departmentId: 'dept-1',
        roles: [ROLES.STUDENT],
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
