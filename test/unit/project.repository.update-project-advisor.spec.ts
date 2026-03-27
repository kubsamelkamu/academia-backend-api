import { ProjectRepository } from '../../src/modules/project/project.repository';

describe('ProjectRepository.updateProjectAdvisor', () => {
  it('downgrades previous advisor membership role on reassignment (Policy B)', async () => {
    const tx: any = {
      project: {
        findUnique: jest.fn().mockResolvedValue({ advisorId: 'advisor-old' }),
        update: jest.fn().mockResolvedValue({
          id: 'project-1',
          tenantId: 'tenant-1',
          members: [
            { userId: 'student-1', role: 'STUDENT' },
            { userId: 'advisor-old', role: 'ADVISOR' },
          ],
        }),
      },
      projectMember: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        upsert: jest.fn().mockResolvedValue({ id: 'pm-1' }),
      },
    };

    const prisma: any = {
      $transaction: jest.fn().mockImplementation(async (fn: any) => fn(tx)),
    };

    const repo = new ProjectRepository(prisma);

    await repo.updateProjectAdvisor('project-1', 'advisor-new');

    expect(tx.project.findUnique).toHaveBeenCalledWith({
      where: { id: 'project-1' },
      select: { advisorId: true },
    });

    expect(tx.project.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'project-1' },
        data: { advisorId: 'advisor-new' },
      })
    );

    expect(tx.projectMember.updateMany).toHaveBeenCalledWith({
      where: {
        projectId: 'project-1',
        userId: 'advisor-old',
        role: 'ADVISOR',
      },
      data: {
        role: 'STUDENT',
      },
    });

    expect(tx.projectMember.upsert).toHaveBeenCalledWith({
      where: {
        projectId_userId: {
          projectId: 'project-1',
          userId: 'advisor-new',
        },
      },
      update: { role: 'ADVISOR' },
      create: {
        projectId: 'project-1',
        userId: 'advisor-new',
        role: 'ADVISOR',
      },
    });
  });
});
