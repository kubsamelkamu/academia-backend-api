import { MilestoneStatus } from '@prisma/client';
import { ProjectRepository } from '../../src/modules/project/project.repository';

describe('ProjectRepository.createProjectFromProposal', () => {
  it('adds all project group students as project members when the proposal belongs to a group', async () => {
    const tx: any = {
      project: {
        create: jest.fn().mockResolvedValue({
          id: 'project-1',
          createdAt: new Date('2026-03-30T10:00:00.000Z'),
        }),
      },
      projectMember: {
        createMany: jest.fn().mockResolvedValue({ count: 3 }),
        upsert: jest.fn().mockResolvedValue({ id: 'advisor-member-1' }),
      },
      milestone: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    const prisma: any = {
      proposal: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'proposal-1',
          tenantId: 'tenant-1',
          departmentId: 'dept-1',
          title: 'Approved Proposal',
          description: 'Proposal description',
          submittedBy: 'leader-1',
          projectGroup: {
            leaderUserId: 'leader-1',
            members: [{ userId: 'member-1' }, { userId: 'member-2' }],
          },
        }),
      },
      milestoneTemplate: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'template-1',
          milestones: [
            {
              title: 'Project Proposal',
              description: 'Submit proposal',
              defaultDurationDays: 7,
              sequence: 1,
            },
          ],
        }),
      },
      $transaction: jest.fn().mockImplementation(async (fn: any) => fn(tx)),
    };

    const repo = new ProjectRepository(prisma);

    await repo.createProjectFromProposal('proposal-1', 'advisor-1', 'template-1');

    expect(tx.projectMember.createMany).toHaveBeenCalledWith({
      data: [
        {
          projectId: 'project-1',
          userId: 'leader-1',
          role: 'STUDENT',
        },
        {
          projectId: 'project-1',
          userId: 'member-1',
          role: 'STUDENT',
        },
        {
          projectId: 'project-1',
          userId: 'member-2',
          role: 'STUDENT',
        },
      ],
      skipDuplicates: true,
    });
  });

  it('marks the first generated milestone as approved and submitted at project creation time', async () => {
    const createdAt = new Date('2026-03-30T10:00:00.000Z');

    const tx: any = {
      project: {
        create: jest.fn().mockResolvedValue({
          id: 'project-1',
          createdAt,
        }),
      },
      projectMember: {
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        upsert: jest.fn().mockResolvedValue({ id: 'member-2' }),
      },
      milestone: {
        createMany: jest.fn().mockResolvedValue({ count: 2 }),
      },
    };

    const prisma: any = {
      proposal: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'proposal-1',
          tenantId: 'tenant-1',
          departmentId: 'dept-1',
          title: 'Approved Proposal',
          description: 'Proposal description',
          submittedBy: 'student-1',
          projectGroup: null,
        }),
      },
      milestoneTemplate: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'template-1',
          milestones: [
            {
              title: 'Project Proposal',
              description: 'Submit proposal',
              defaultDurationDays: 7,
              sequence: 1,
            },
            {
              title: 'Chapter One',
              description: 'Draft chapter one',
              defaultDurationDays: 14,
              sequence: 2,
            },
          ],
        }),
      },
      $transaction: jest.fn().mockImplementation(async (fn: any) => fn(tx)),
    };

    const repo = new ProjectRepository(prisma);

    await repo.createProjectFromProposal('proposal-1', 'advisor-1', 'template-1');

    expect(tx.milestone.createMany).toHaveBeenCalledWith({
      data: [
        {
          projectId: 'project-1',
          title: 'Project Proposal',
          description: 'Submit proposal',
          dueDate: new Date('2026-04-06T10:00:00.000Z'),
          status: MilestoneStatus.APPROVED,
          submittedAt: createdAt,
        },
        {
          projectId: 'project-1',
          title: 'Chapter One',
          description: 'Draft chapter one',
          dueDate: new Date('2026-04-20T10:00:00.000Z'),
          status: MilestoneStatus.PENDING,
          submittedAt: null,
        },
      ],
    });
  });
});