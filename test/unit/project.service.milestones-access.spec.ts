import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProjectService } from '../../src/modules/project/project.service';

describe('ProjectService.getProjectMilestones access', () => {
  const repo: any = {
    findProjectById: jest.fn(),
    findProjectMember: jest.fn(),
    findMilestonesByProject: jest.fn(),
  };

  const notificationService: any = {};
  const cloudinaryService: any = {};
  const projectEmailService: any = {};

  let service: ProjectService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new ProjectService(repo, notificationService, cloudinaryService, projectEmailService);
  });

  it('throws 404 when project not found', async () => {
    repo.findProjectById.mockResolvedValue(null);

    await expect(
      service.getProjectMilestones('p1', { sub: 'u1', roles: [] })
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('allows access for project member even without department access', async () => {
    repo.findProjectById.mockResolvedValue({ id: 'p1', departmentId: 'd1' });

    // Ensure hasDepartmentAccess is false (no departmentId, no privileged roles)
    const user = { sub: 'u1', roles: ['Student'] };

    repo.findProjectMember.mockResolvedValue({ id: 'm1', projectId: 'p1', userId: 'u1' });
    repo.findMilestonesByProject.mockResolvedValue([{ id: 'ms1' }]);

    const result = await service.getProjectMilestones('p1', user);

    expect(repo.findProjectMember).toHaveBeenCalledWith('p1', 'u1');
    expect(repo.findMilestonesByProject).toHaveBeenCalledWith('p1');
    expect(result).toEqual([{ id: 'ms1' }]);
  });

  it('rejects access for non-member without department access', async () => {
    repo.findProjectById.mockResolvedValue({ id: 'p1', departmentId: 'd1' });

    const user = { sub: 'u2', roles: ['Student'] };

    repo.findProjectMember.mockResolvedValue(null);

    await expect(service.getProjectMilestones('p1', user)).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });
});
