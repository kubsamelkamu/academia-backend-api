import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { ROLES } from '../../src/common/constants/roles.constants';
import { ProjectService } from '../../src/modules/project/project.service';

describe('ProjectService.assignProposalAdvisor', () => {
  const projectRepository: any = {
    findProposalById: jest.fn(),
    findAdvisorByUserId: jest.fn(),
    updateProposalAdvisor: jest.fn(),
    getOrCreateDepartmentDefaultMilestoneTemplateId: jest.fn(),
    createProjectFromProposal: jest.fn(),
  };

  const notificationService: any = {};
  const cloudinaryService: any = {};
  const projectEmailService: any = {};

  let service: ProjectService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new ProjectService(
      projectRepository,
      notificationService,
      cloudinaryService,
      projectEmailService
    );

    jest.spyOn(service as any, 'assertReviewerDepartmentAccess').mockResolvedValue(undefined);
  });

  it('assigns an advisor to an approved proposal without a project', async () => {
    projectRepository.findProposalById.mockResolvedValue({
      id: 'proposal-1',
      tenantId: 'tenant-1',
      departmentId: 'dept-1',
      status: 'APPROVED',
      advisorId: null,
      project: null,
    });

    projectRepository.findAdvisorByUserId.mockResolvedValue({
      user: {
        id: 'advisor-1',
        tenantId: 'tenant-1',
        status: 'ACTIVE',
      },
      departmentId: 'dept-1',
    });

    projectRepository.updateProposalAdvisor.mockResolvedValue({
      id: 'proposal-1',
      tenantId: 'tenant-1',
      departmentId: 'dept-1',
      title: 'Approved Title',
      proposedTitles: ['Approved Title', 'Option 2', 'Option 3'],
      selectedTitleIndex: 0,
      advisorId: 'advisor-1',
      updatedAt: new Date('2026-03-30T12:00:00.000Z'),
    });

    projectRepository.getOrCreateDepartmentDefaultMilestoneTemplateId.mockResolvedValue('tpl-1');
    projectRepository.createProjectFromProposal.mockResolvedValue({
      id: 'project-1',
      advisorId: 'advisor-1',
    });

    projectEmailService.sendProjectCreatedEmails = jest.fn().mockResolvedValue(undefined);

    const result = await service.assignProposalAdvisor(
      'proposal-1',
      { advisorId: 'advisor-1' } as any,
      { sub: 'coordinator-1', roles: [ROLES.COORDINATOR] }
    );

    expect(projectRepository.updateProposalAdvisor).toHaveBeenCalledWith('proposal-1', 'advisor-1');
    expect(projectRepository.createProjectFromProposal).toHaveBeenCalledWith(
      'proposal-1',
      'advisor-1',
      'tpl-1'
    );
    expect(result.transitionSummary).toEqual({
      proposalId: 'proposal-1',
      advisorId: 'advisor-1',
      projectId: 'project-1',
      action: 'ADVISOR_ASSIGNED_AND_PROJECT_CREATED',
    });
    expect(result.proposal.assignmentSummary).toEqual({
      proposalId: 'proposal-1',
      advisorId: 'advisor-1',
      assignedByUserId: 'coordinator-1',
      updatedAt: new Date('2026-03-30T12:00:00.000Z'),
    });
    expect(result.project.creationSummary).toEqual({
      projectId: 'project-1',
      proposalId: 'proposal-1',
      finalTitle: 'Approved Title',
      selectedTitleIndex: 0,
      advisorId: 'advisor-1',
    });
  });

  it('rejects assignment when proposal is not approved', async () => {
    projectRepository.findProposalById.mockResolvedValue({
      id: 'proposal-1',
      tenantId: 'tenant-1',
      departmentId: 'dept-1',
      status: 'SUBMITTED',
      project: null,
    });

    await expect(
      service.assignProposalAdvisor(
        'proposal-1',
        { advisorId: 'advisor-1' } as any,
        { sub: 'coordinator-1', roles: [ROLES.COORDINATOR] }
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects assignment when proposal already has a project', async () => {
    projectRepository.findProposalById.mockResolvedValue({
      id: 'proposal-1',
      tenantId: 'tenant-1',
      departmentId: 'dept-1',
      status: 'APPROVED',
      project: { id: 'project-1' },
    });

    await expect(
      service.assignProposalAdvisor(
        'proposal-1',
        { advisorId: 'advisor-1' } as any,
        { sub: 'coordinator-1', roles: [ROLES.COORDINATOR] }
      )
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects users without reviewer permission', async () => {
    projectRepository.findProposalById.mockResolvedValue({
      id: 'proposal-1',
      tenantId: 'tenant-1',
      departmentId: 'dept-1',
      status: 'APPROVED',
      project: null,
    });

    await expect(
      service.assignProposalAdvisor(
        'proposal-1',
        { advisorId: 'advisor-1' } as any,
        { sub: 'student-1', roles: [ROLES.STUDENT] }
      )
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws not found when proposal does not exist', async () => {
    projectRepository.findProposalById.mockResolvedValue(null);

    await expect(
      service.assignProposalAdvisor(
        'proposal-1',
        { advisorId: 'advisor-1' } as any,
        { sub: 'coordinator-1', roles: [ROLES.COORDINATOR] }
      )
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});