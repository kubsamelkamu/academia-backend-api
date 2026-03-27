import { Test } from '@nestjs/testing';
import { ProjectService } from '../../src/modules/project/project.service';
import { ProjectRepository } from '../../src/modules/project/project.repository';
import { NotificationService } from '../../src/modules/notification/notification.service';
import { CloudinaryService } from '../../src/core/storage/cloudinary.service';
import { ROLES } from '../../src/common/constants/roles.constants';

describe('ProjectService notifications', () => {
  let service: ProjectService;
  let projectRepository: { [key: string]: jest.Mock };
  let notificationService: { [key: string]: jest.Mock };

  beforeEach(async () => {
    projectRepository = {
      findProposalById: jest.fn(),
      createProposalFeedback: jest.fn(),
      findProjectById: jest.fn(),
      updateProjectAdvisor: jest.fn(),
    };

    notificationService = {
      notifyProposalFeedbackAdded: jest.fn(),
      notifyProjectAdvisorAssigned: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ProjectService,
        { provide: ProjectRepository, useValue: projectRepository },
        { provide: NotificationService, useValue: notificationService },
        { provide: CloudinaryService, useValue: {} },
      ],
    }).compile();

    service = moduleRef.get(ProjectService);

    // Avoid dealing with department guard details in this focused test.
    jest
      .spyOn(service as any, 'assertReviewerDepartmentAccess')
      .mockResolvedValue(undefined);
    jest.spyOn(service as any, 'canAssignAdvisor').mockReturnValue(true);
  });

  it('notifies submitter when proposal feedback is added', async () => {
    projectRepository.findProposalById.mockResolvedValue({
      id: 'proposal-1',
      tenantId: 'tenant-1',
      departmentId: 'dept-1',
      status: 'SUBMITTED',
      submittedBy: 'student-1',
    });

    projectRepository.createProposalFeedback.mockResolvedValue({
      id: 'feedback-1',
      message: 'Looks good, but improve section 2.',
    });

    const user = { sub: 'reviewer-1', roles: [ROLES.COORDINATOR], tenantId: 'tenant-1' };

    await service.addProposalFeedback('proposal-1', { message: 'Looks good, but improve section 2.' } as any, user);

    expect(notificationService.notifyProposalFeedbackAdded).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        proposalId: 'proposal-1',
        recipientUserIds: ['student-1'],
        authorUserId: 'reviewer-1',
      })
    );
  });

  it('notifies members and advisor when advisor is assigned', async () => {
    projectRepository.findProjectById.mockResolvedValue({
      id: 'project-1',
      tenantId: 'tenant-1',
      departmentId: 'dept-1',
    });

    projectRepository.updateProjectAdvisor.mockResolvedValue({
      id: 'project-1',
      tenantId: 'tenant-1',
      members: [{ userId: 'student-1' }, { userId: 'student-2' }],
    });

    const user = { sub: 'coordinator-1', roles: [ROLES.COORDINATOR], tenantId: 'tenant-1' };

    await service.assignAdvisor('project-1', { advisorId: 'advisor-1' } as any, user);

    expect(notificationService.notifyProjectAdvisorAssigned).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        projectId: 'project-1',
        advisorUserId: 'advisor-1',
        actorUserId: 'coordinator-1',
        recipientUserIds: expect.arrayContaining(['student-1', 'student-2', 'advisor-1']),
      })
    );
  });
});
