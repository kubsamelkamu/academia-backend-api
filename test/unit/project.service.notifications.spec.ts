import { Test } from '@nestjs/testing';
import { ProjectService } from '../../src/modules/project/project.service';
import { ProjectRepository } from '../../src/modules/project/project.repository';
import { NotificationService } from '../../src/modules/notification/notification.service';
import { CloudinaryService } from '../../src/core/storage/cloudinary.service';
import { ROLES } from '../../src/common/constants/roles.constants';
import { ProjectEmailService } from '../../src/modules/project/project-email.service';

describe('ProjectService notifications', () => {
  let service: ProjectService;
  let projectRepository: { [key: string]: jest.Mock };
  let notificationService: { [key: string]: jest.Mock };
  let projectEmailService: { [key: string]: jest.Mock };

  beforeEach(async () => {
    projectRepository = {
      findProposalById: jest.fn(),
      createProposalFeedback: jest.fn(),
      findProjectById: jest.fn(),
      updateProjectAdvisor: jest.fn(),
      findProjectEvaluators: jest.fn(),
      findMilestoneByIdWithProject: jest.fn(),
      approveMilestoneSubmission: jest.fn(),
      findProjectMembers: jest.fn(),
      findDepartmentActivityTarget: jest.fn(),
    };

    notificationService = {
      notifyProposalFeedbackAdded: jest.fn(),
      notifyProjectAdvisorAssigned: jest.fn(),
      notifyProjectAdvisorAssignedDepartmentActivity: jest.fn(),
      notifyMilestoneApproved: jest.fn(),
      notifyMilestoneCompleted: jest.fn(),
    };

    projectEmailService = {
      sendProposalFeedbackAddedEmails: jest.fn(),
      sendProjectAdvisorAssignedEmails: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ProjectService,
        { provide: ProjectRepository, useValue: projectRepository },
        { provide: NotificationService, useValue: notificationService },
        { provide: CloudinaryService, useValue: {} },
        { provide: ProjectEmailService, useValue: projectEmailService },
      ],
    }).compile();

    service = moduleRef.get(ProjectService);

    // Avoid dealing with department guard details in this focused test.
    jest.spyOn(service as any, 'assertReviewerDepartmentAccess').mockResolvedValue(undefined);
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

    await service.addProposalFeedback(
      'proposal-1',
      { message: 'Looks good, but improve section 2.' } as any,
      user
    );

    expect(notificationService.notifyProposalFeedbackAdded).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        proposalId: 'proposal-1',
        recipientUserIds: ['student-1'],
        authorUserId: 'reviewer-1',
      })
    );
    expect(projectEmailService.sendProposalFeedbackAddedEmails).toHaveBeenCalledWith(
      expect.objectContaining({
        proposalId: 'proposal-1',
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

    projectRepository.findProjectEvaluators.mockResolvedValue([]);

    projectRepository.updateProjectAdvisor.mockResolvedValue({
      id: 'project-1',
      tenantId: 'tenant-1',
      departmentId: 'dept-1',
      title: 'Project One',
      members: [{ userId: 'student-1' }, { userId: 'student-2' }],
    });

    projectRepository.findDepartmentActivityTarget.mockResolvedValue({
      id: 'dept-1',
      headOfDepartmentId: 'hod-1',
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
    expect(projectEmailService.sendProjectAdvisorAssignedEmails).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'project-1',
        advisorUserId: 'advisor-1',
        actorUserId: 'coordinator-1',
      })
    );

    expect(notificationService.notifyProjectAdvisorAssignedDepartmentActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        userIds: ['hod-1'],
        departmentId: 'dept-1',
        projectId: 'project-1',
        advisorUserId: 'advisor-1',
        actorUserId: 'coordinator-1',
      })
    );
  });

  it('notifies project students when a milestone submission is approved', async () => {
    projectRepository.findMilestoneByIdWithProject.mockResolvedValue({
      id: 'milestone-1',
      title: 'Milestone 2',
      project: {
        id: 'project-1',
        title: 'Research Platform',
        tenantId: 'tenant-1',
        departmentId: 'dept-1',
        advisorId: 'advisor-1',
        milestoneTemplateId: null,
        proposal: {
          projectGroup: {
            id: 'group-1',
            name: 'Team Alpha',
          },
        },
      },
    });

    projectRepository.approveMilestoneSubmission.mockResolvedValue({
      id: 'submission-1',
      milestoneId: 'milestone-1',
      status: 'APPROVED',
    });

    projectRepository.findProjectMembers.mockResolvedValue({
      id: 'project-1',
      members: [
        { userId: 'student-1', role: 'STUDENT' },
        { userId: 'student-2', role: 'STUDENT' },
        { userId: 'advisor-1', role: 'ADVISOR' },
      ],
    });

    projectRepository.findDepartmentActivityTarget.mockResolvedValue({
      id: 'dept-1',
      headOfDepartmentId: 'hod-1',
    });

    await service.approveMilestoneSubmission('milestone-1', 'submission-1', {
      sub: 'advisor-1',
      roles: [ROLES.ADVISOR],
      departmentId: 'dept-1',
    });

    expect(notificationService.notifyMilestoneApproved).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        projectId: 'project-1',
        milestoneId: 'milestone-1',
        submissionId: 'submission-1',
        userIds: ['student-1', 'student-2'],
        actorUserId: 'advisor-1',
      })
    );

    expect(notificationService.notifyMilestoneCompleted).toHaveBeenCalledWith(
      expect.objectContaining({
        userIds: ['hod-1'],
      })
    );
  });
});
