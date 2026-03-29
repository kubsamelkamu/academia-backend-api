import { ProjectRepository } from '../../src/modules/project/project.repository';

describe('ProjectRepository.listApprovedGroupMemberUserIdsForStudent', () => {
  it('returns the approved group for a leader even when no project_group_members row exists for the leader', async () => {
    const prisma: any = {
      projectGroup: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'group-1',
          leaderUserId: 'leader-1',
          members: [{ userId: 'member-1' }, { userId: 'member-2' }],
        }),
      },
    };

    const repo = new ProjectRepository(prisma);

    const result = await repo.listApprovedGroupMemberUserIdsForStudent({
      tenantId: 'tenant-1',
      departmentId: 'dept-1',
      studentUserId: 'leader-1',
    });

    expect(prisma.projectGroup.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant-1',
        departmentId: 'dept-1',
        status: 'APPROVED',
        OR: [{ leaderUserId: 'leader-1' }, { members: { some: { userId: 'leader-1' } } }],
      },
      select: {
        id: true,
        leaderUserId: true,
        members: {
          select: {
            userId: true,
          },
        },
      },
    });

    expect(result).toEqual({
      projectGroupId: 'group-1',
      memberUserIds: ['leader-1', 'member-1', 'member-2'],
    });
  });
});