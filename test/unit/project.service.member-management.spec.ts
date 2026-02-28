import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProjectService } from '../../src/modules/project/project.service';
import { ROLES } from '../../src/common/constants/roles.constants';

describe('ProjectService member management', () => {
  const repo: any = {
    findProjectForMemberManagement: jest.fn(),
    findDepartmentGroupSizeSetting: jest.fn(),
    findUserForProjectMembership: jest.fn(),
    userHasActiveRoleInTenant: jest.fn(),
    upsertStudentMember: jest.fn(),
    findProjectMember: jest.fn(),
    removeProjectMember: jest.fn(),
  };

  let service: ProjectService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new ProjectService(repo);
  });

  it('blocks adding when maxGroupSize would be exceeded', async () => {
    repo.findProjectForMemberManagement.mockResolvedValue({
      id: 'p1',
      tenantId: 't1',
      departmentId: 'd1',
      members: [
        { userId: 's1', role: 'STUDENT' },
        { userId: 's2', role: 'STUDENT' },
      ],
    });
    repo.findUserForProjectMembership.mockResolvedValue({
      id: 'actor',
      tenantId: 't1',
      departmentId: 'd1',
      status: 'ACTIVE',
    });
    repo.findDepartmentGroupSizeSetting.mockResolvedValue({ minGroupSize: 1, maxGroupSize: 2 });

    await expect(
      service.addStudentMember(
        'p1',
        { userId: 's3' } as any,
        { sub: 'actor', roles: [ROLES.DEPARTMENT_HEAD] }
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks removing when minGroupSize would be violated', async () => {
    repo.findProjectForMemberManagement.mockResolvedValue({
      id: 'p1',
      tenantId: 't1',
      departmentId: 'd1',
      members: [
        { userId: 's1', role: 'STUDENT' },
        { userId: 's2', role: 'STUDENT' },
      ],
    });
    repo.findUserForProjectMembership.mockResolvedValue({
      id: 'actor',
      tenantId: 't1',
      departmentId: 'd1',
      status: 'ACTIVE',
    });
    repo.findProjectMember.mockResolvedValue({ id: 'm1', projectId: 'p1', userId: 's2', role: 'STUDENT' });
    repo.findDepartmentGroupSizeSetting.mockResolvedValue({ minGroupSize: 2, maxGroupSize: 6 });

    await expect(
      service.removeStudentMember('p1', 's2', { sub: 'actor', roles: [ROLES.COORDINATOR] })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('requires actor to belong to same tenant/department unless PlatformAdmin', async () => {
    repo.findProjectForMemberManagement.mockResolvedValue({
      id: 'p1',
      tenantId: 't1',
      departmentId: 'd1',
      members: [],
    });
    repo.findUserForProjectMembership.mockResolvedValue({
      id: 'actor',
      tenantId: 't1',
      departmentId: 'd2',
      status: 'ACTIVE',
    });

    await expect(
      service.addStudentMember(
        'p1',
        { userId: 's1' } as any,
        { sub: 'actor', roles: [ROLES.DEPARTMENT_HEAD] }
      )
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws NotFound when project does not exist', async () => {
    repo.findProjectForMemberManagement.mockResolvedValue(null);

    await expect(
      service.addStudentMember('missing', { userId: 'u1' } as any, {
        sub: 'actor',
        roles: [ROLES.DEPARTMENT_HEAD],
      })
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
