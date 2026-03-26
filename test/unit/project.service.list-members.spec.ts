import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProjectService } from '../../src/modules/project/project.service';
import { ROLES } from '../../src/common/constants/roles.constants';

describe('ProjectService.listProjectMembers', () => {
  const repo: any = {
    findProjectMembers: jest.fn(),
    findUserForProjectMembership: jest.fn(),
  };

  const notificationService: any = {};

  let service: ProjectService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new ProjectService(repo, notificationService);
  });

  it('throws NotFound when project does not exist', async () => {
    repo.findProjectMembers.mockResolvedValue(null);

    await expect(
      service.listProjectMembers('p1', { sub: 'u1', roles: [ROLES.COORDINATOR] })
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('allows platform admin without department checks', async () => {
    repo.findProjectMembers.mockResolvedValue({
      id: 'p1',
      tenantId: 't1',
      departmentId: 'd1',
      status: 'ACTIVE',
      members: [{ userId: 's1', role: 'STUDENT', joinedAt: new Date(), user: { id: 's1' } }],
    });

    const result = await service.listProjectMembers('p1', {
      sub: 'admin',
      roles: [ROLES.PLATFORM_ADMIN],
    });

    expect(result).toEqual({ projectId: 'p1', members: expect.any(Array) });
  });

  it('blocks student when not a member', async () => {
    repo.findProjectMembers.mockResolvedValue({
      id: 'p1',
      tenantId: 't1',
      departmentId: 'd1',
      status: 'ACTIVE',
      members: [{ userId: 'other', role: 'STUDENT', joinedAt: new Date(), user: { id: 'other' } }],
    });

    await expect(
      service.listProjectMembers('p1', { sub: 's1', roles: [ROLES.STUDENT] })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows student when they are a member', async () => {
    repo.findProjectMembers.mockResolvedValue({
      id: 'p1',
      tenantId: 't1',
      departmentId: 'd1',
      status: 'ACTIVE',
      members: [{ userId: 's1', role: 'STUDENT', joinedAt: new Date(), user: { id: 's1' } }],
    });

    const result = await service.listProjectMembers('p1', { sub: 's1', roles: [ROLES.STUDENT] });

    expect(result).toEqual({ projectId: 'p1', members: expect.any(Array) });
  });
});
