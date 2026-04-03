import { BadRequestException } from '@nestjs/common';

import { ROLES } from '../../src/common/constants/roles.constants';
import { ProjectGroupService } from '../../src/modules/project-group/project-group.service';

describe('ProjectGroupService.getMyAdvisor', () => {
  const prisma: any = {};
  const config: any = {};
  const email: any = {};
  const queueService: any = {};
  const cloudinary: any = {};
  const authRepository: any = {
    findUserById: jest.fn(),
  };
  const projectGroupRepository: any = {
    findMyAdvisorForStudent: jest.fn(),
  };
  const notificationGateway: any = {};
  const notificationService: any = {
    notifyProjectGroupFormed: jest.fn(),
  };

  let service: ProjectGroupService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new ProjectGroupService(
      prisma,
      config,
      email,
      queueService,
      cloudinary,
      authRepository,
      projectGroupRepository,
      notificationGateway,
      notificationService
    );

    authRepository.findUserById.mockResolvedValue({
      id: 'student-1',
      tenantId: 'tenant-1',
      departmentId: 'dept-1',
      status: 'ACTIVE',
    });
  });

  it('returns full advisor details for a project group student', async () => {
    projectGroupRepository.findMyAdvisorForStudent.mockResolvedValue({
      group: {
        id: 'group-1',
        name: 'Team Alpha',
        status: 'APPROVED',
      },
      source: {
        type: 'PROJECT',
        proposalId: 'proposal-1',
        proposalTitle: 'Smart Campus Navigation',
        projectId: 'project-1',
        projectTitle: 'Smart Campus Navigation',
      },
      advisor: {
        id: 'advisor-1',
        firstName: 'Alem',
        lastName: 'Bekele',
        email: 'alem@example.com',
        avatarUrl: 'https://example.com/avatar.png',
      },
    });

    const result = await service.getMyAdvisor({
      sub: 'student-1',
      roles: [ROLES.STUDENT],
    });

    expect(projectGroupRepository.findMyAdvisorForStudent).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      departmentId: 'dept-1',
      userId: 'student-1',
    });
    expect(result).toEqual({
      group: {
        id: 'group-1',
        name: 'Team Alpha',
        status: 'APPROVED',
      },
      source: {
        type: 'PROJECT',
        proposalId: 'proposal-1',
        proposalTitle: 'Smart Campus Navigation',
        projectId: 'project-1',
        projectTitle: 'Smart Campus Navigation',
      },
      advisor: {
        id: 'advisor-1',
        firstName: 'Alem',
        lastName: 'Bekele',
        fullName: 'Alem Bekele',
        email: 'alem@example.com',
        avatarUrl: 'https://example.com/avatar.png',
      },
    });
  });

  it('rejects when no advisor is assigned yet', async () => {
    projectGroupRepository.findMyAdvisorForStudent.mockResolvedValue({
      group: {
        id: 'group-1',
        name: 'Team Alpha',
        status: 'APPROVED',
      },
      source: {
        type: null,
        proposalId: null,
        proposalTitle: null,
        projectId: null,
        projectTitle: null,
      },
      advisor: null,
    });

    await expect(
      service.getMyAdvisor({
        sub: 'student-1',
        roles: [ROLES.STUDENT],
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});