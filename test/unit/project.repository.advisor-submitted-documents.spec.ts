import { ProjectRepository } from '../../src/modules/project/project.repository';

describe('ProjectRepository.listAdvisorSubmittedDocuments', () => {
  it('returns latest submission per milestone with derived dashboard summary counts', async () => {
    const prisma: any = {
      project: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'project-1',
            title: 'Project 1',
            status: 'ACTIVE',
            createdAt: new Date('2026-04-06T09:00:00.000Z'),
            proposal: { projectGroup: { id: 'group-1', name: 'Group One' } },
          },
        ]),
      },
      milestone: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'milestone-1',
            title: 'SRS',
            description: 'Submit SRS',
            status: 'SUBMITTED',
            dueDate: new Date('2026-04-10T00:00:00.000Z'),
            submittedAt: new Date('2026-04-06T10:00:00.000Z'),
            project: {
              id: 'project-1',
              title: 'Project 1',
              status: 'ACTIVE',
              proposal: { projectGroup: { id: 'group-1', name: 'Group One' } },
            },
            submissions: [
              {
                id: 'submission-1',
                status: 'SUBMITTED',
                fileName: 'srs-v1.docx',
                mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                sizeBytes: 1234,
                fileUrl: 'https://example.com/srs-v1.docx',
                filePublicId: 'public-1',
                resourceType: 'raw',
                createdAt: new Date('2026-04-06T10:00:00.000Z'),
                approvedAt: null,
                uploadedBy: {
                  id: 'student-1',
                  firstName: 'A',
                  lastName: 'Student',
                  email: 'a@example.com',
                  avatarUrl: null,
                },
                feedbacks: [],
              },
            ],
          },
          {
            id: 'milestone-2',
            title: 'SDD',
            description: 'Submit SDD',
            status: 'SUBMITTED',
            dueDate: new Date('2026-04-12T00:00:00.000Z'),
            submittedAt: new Date('2026-04-06T11:00:00.000Z'),
            project: {
              id: 'project-1',
              title: 'Project 1',
              status: 'ACTIVE',
              proposal: { projectGroup: { id: 'group-1', name: 'Group One' } },
            },
            submissions: [
              {
                id: 'submission-2',
                status: 'SUBMITTED',
                fileName: 'sdd-v2.pdf',
                mimeType: 'application/pdf',
                sizeBytes: 5678,
                fileUrl: 'https://example.com/sdd-v2.pdf',
                filePublicId: 'public-2',
                resourceType: 'raw',
                createdAt: new Date('2026-04-06T11:00:00.000Z'),
                approvedAt: null,
                uploadedBy: {
                  id: 'student-2',
                  firstName: 'B',
                  lastName: 'Student',
                  email: 'b@example.com',
                  avatarUrl: null,
                },
                feedbacks: [
                  {
                    id: 'feedback-1',
                    message: 'Please revise section 2',
                    createdAt: new Date('2026-04-06T12:00:00.000Z'),
                    attachmentUrl: 'https://example.com/review.pdf',
                    attachmentFileName: 'review.pdf',
                    authorRole: 'Advisor',
                    author: {
                      id: 'advisor-1',
                      firstName: 'Advisor',
                      lastName: 'One',
                      email: 'advisor@example.com',
                      avatarUrl: null,
                    },
                  },
                ],
              },
            ],
          },
          {
            id: 'milestone-3',
            title: 'Implementation',
            description: 'Submit report',
            status: 'APPROVED',
            dueDate: new Date('2026-04-15T00:00:00.000Z'),
            submittedAt: new Date('2026-04-06T13:00:00.000Z'),
            project: {
              id: 'project-1',
              title: 'Project 1',
              status: 'ACTIVE',
              proposal: { projectGroup: { id: 'group-1', name: 'Group One' } },
            },
            submissions: [
              {
                id: 'submission-3',
                status: 'APPROVED',
                fileName: 'impl.pdf',
                mimeType: 'application/pdf',
                sizeBytes: 91011,
                fileUrl: 'https://example.com/impl.pdf',
                filePublicId: 'public-3',
                resourceType: 'raw',
                createdAt: new Date('2026-04-06T13:00:00.000Z'),
                approvedAt: new Date('2026-04-06T14:00:00.000Z'),
                uploadedBy: {
                  id: 'student-3',
                  firstName: 'C',
                  lastName: 'Student',
                  email: 'c@example.com',
                  avatarUrl: null,
                },
                feedbacks: [],
              },
            ],
          },
        ]),
      },
    };

    const repo = new ProjectRepository(prisma);

    const result = await repo.listAdvisorSubmittedDocuments('advisor-user-1');

    expect(prisma.project.findMany).toHaveBeenCalledWith({
      where: { advisorId: 'advisor-user-1' },
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        proposal: {
          select: {
            projectGroup: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    expect(result.summary).toEqual({
      totalSubmittedDocuments: 3,
      approved: 1,
      pendingReview: 1,
      revisionRequested: 1,
    });
    expect(result.documents).toHaveLength(3);

    const approvedDocument = result.documents.find(
      (document: any) => document.submissionId === 'submission-3'
    );
    const revisionRequestedDocument = result.documents.find(
      (document: any) => document.submissionId === 'submission-2'
    );
    const pendingReviewDocument = result.documents.find(
      (document: any) => document.submissionId === 'submission-1'
    );

    expect(approvedDocument).toEqual(
      expect.objectContaining({
        submissionId: 'submission-3',
        documentName: 'impl.pdf',
        status: 'APPROVED',
      })
    );
    expect(revisionRequestedDocument).toEqual(
      expect.objectContaining({
        submissionId: 'submission-2',
        status: 'REVISION_REQUESTED',
        review: expect.objectContaining({
          feedbackCount: 1,
          latestFeedbackMessage: 'Please revise section 2',
        }),
      })
    );
    expect(pendingReviewDocument).toEqual(
      expect.objectContaining({
        submissionId: 'submission-1',
        status: 'PENDING_REVIEW',
      })
    );
  });
});
