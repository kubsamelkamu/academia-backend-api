import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ProposalStatus } from '@prisma/client';
import { ROLES } from '../../src/common/constants/roles.constants';
import { ProjectService } from '../../src/modules/project/project.service';

describe('ProjectService.createProposalRejectionReminder', () => {
  const repo: any = {
    findProposalById: jest.fn(),
    findUserForProjectMembership: jest.fn(),
    findActiveProposalRejectionReminder: jest.fn(),
    createProposalRejectionReminder: jest.fn(),
  };

  const notificationService: any = {};
  const cloudinaryService: any = {};
  const projectEmailService: any = {};

  let service: ProjectService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new ProjectService(repo, notificationService, cloudinaryService, projectEmailService);

    notificationService.notifyProposalResubmissionReminderCreated = jest.fn();
    projectEmailService.sendProposalResubmissionReminder24hEmails = jest.fn();
    projectEmailService.sendProposalResubmissionReminder1hEmails = jest.fn();
    projectEmailService.sendProposalResubmissionDeadlinePassedEmails = jest.fn();

    repo.findUserForProjectMembership.mockResolvedValue({
      id: 'reviewer-1',
      tenantId: 'tenant-1',
      departmentId: 'dept-1',
      status: 'ACTIVE',
    });

    repo.findActiveProposalRejectionReminder.mockResolvedValue(null);
  });

  it('creates a reminder for a rejected proposal with approved group', async () => {
    repo.findProposalById.mockResolvedValue({
      id: 'proposal-1',
      tenantId: 'tenant-1',
      departmentId: 'dept-1',
      status: ProposalStatus.REJECTED,
      projectGroup: {
        id: 'group-1',
        status: 'APPROVED',
        leader: { id: 'leader-1' },
        members: [{ user: { id: 'leader-1' } }, { user: { id: 'student-2' } }],
      },
    });

    repo.createProposalRejectionReminder.mockResolvedValue({
      id: 'announcement-1',
      proposalId: 'proposal-1',
      projectGroupId: 'group-1',
      title: 'Proposal Resubmission Reminder',
    });

    const result = await service.createProposalRejectionReminder(
      'proposal-1',
      {
        deadlineAt: '2026-04-10T12:00:00.000Z',
      } as any,
      { sub: 'reviewer-1', roles: [ROLES.COORDINATOR] }
    );

    expect(repo.createProposalRejectionReminder).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        departmentId: 'dept-1',
        projectGroupId: 'group-1',
        proposalId: 'proposal-1',
        createdByUserId: 'reviewer-1',
        disableAfterDeadline: true,
      })
    );
    expect(notificationService.notifyProposalResubmissionReminderCreated).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        proposalId: 'proposal-1',
        reminderId: 'announcement-1',
        actorUserId: 'reviewer-1',
        projectGroupId: 'group-1',
        recipientUserIds: expect.arrayContaining(['leader-1', 'student-2']),
      })
    );
    expect(result).toEqual({
      id: 'announcement-1',
      proposalId: 'proposal-1',
      projectGroupId: 'group-1',
      title: 'Proposal Resubmission Reminder',
    });
  });

  it('forbids non-reviewers', async () => {
    await expect(
      service.createProposalRejectionReminder(
        'proposal-1',
        { deadlineAt: '2026-04-10T12:00:00.000Z' } as any,
        { sub: 'student-1', roles: [ROLES.STUDENT] }
      )
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects reminder creation when proposal is not rejected', async () => {
    repo.findProposalById.mockResolvedValue({
      id: 'proposal-1',
      tenantId: 'tenant-1',
      departmentId: 'dept-1',
      status: ProposalStatus.SUBMITTED,
      projectGroup: {
        id: 'group-1',
        status: 'APPROVED',
        leader: { id: 'leader-1' },
        members: [],
      },
    });

    await expect(
      service.createProposalRejectionReminder(
        'proposal-1',
        { deadlineAt: '2026-04-10T12:00:00.000Z' } as any,
        { sub: 'reviewer-1', roles: [ROLES.DEPARTMENT_HEAD] }
      )
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects reminder creation when an active reminder already exists', async () => {
    repo.findProposalById.mockResolvedValue({
      id: 'proposal-1',
      tenantId: 'tenant-1',
      departmentId: 'dept-1',
      status: ProposalStatus.REJECTED,
      projectGroup: {
        id: 'group-1',
        status: 'APPROVED',
        leader: { id: 'leader-1' },
        members: [],
      },
    });

    repo.findActiveProposalRejectionReminder.mockResolvedValue({
      id: 'announcement-1',
      proposalId: 'proposal-1',
    });

    await expect(
      service.createProposalRejectionReminder(
        'proposal-1',
        { deadlineAt: '2026-04-10T12:00:00.000Z' } as any,
        { sub: 'reviewer-1', roles: [ROLES.COORDINATOR] }
      )
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects reminder creation when deadline is not in the future', async () => {
    repo.findProposalById.mockResolvedValue({
      id: 'proposal-1',
      tenantId: 'tenant-1',
      departmentId: 'dept-1',
      status: ProposalStatus.REJECTED,
      projectGroup: {
        id: 'group-1',
        status: 'APPROVED',
        leader: { id: 'leader-1' },
        members: [],
      },
    });

    await expect(
      service.createProposalRejectionReminder(
        'proposal-1',
        { deadlineAt: '2020-01-01T00:00:00.000Z' } as any,
        { sub: 'reviewer-1', roles: [ROLES.COORDINATOR] }
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});