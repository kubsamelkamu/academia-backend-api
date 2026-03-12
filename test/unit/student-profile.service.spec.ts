import { NotFoundException } from '@nestjs/common';

import { StudentProfileService } from '../../src/modules/student-profile/student-profile.service';
import { ROLES } from '../../src/common/constants/roles.constants';
import {
  InsufficientPermissionsException,
  UnauthorizedAccessException,
} from '../../src/common/exceptions';

describe('StudentProfileService', () => {
  const authRepository: any = {
    findUserById: jest.fn(),
  };

  const studentProfileRepository: any = {
    findByUserId: jest.fn(),
    upsertByUserId: jest.fn(),
  };

  let service: StudentProfileService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new StudentProfileService(authRepository, studentProfileRepository);
  });

  it('blocks getMyStudentProfile when actor is not a student', async () => {
    authRepository.findUserById.mockResolvedValue({
      id: 'u1',
      tenantId: 't1',
      email: 'x@x.com',
      firstName: 'A',
      lastName: 'B',
      avatarUrl: null,
      roles: [],
    });

    await expect(
      service.getMyStudentProfile({ sub: 'u1', tenantId: 't1', roles: [ROLES.ADVISOR] })
    ).rejects.toBeInstanceOf(InsufficientPermissionsException);
  });

  it('upserts student profile updates', async () => {
    authRepository.findUserById.mockResolvedValue({
      id: 'u1',
      tenantId: 't1',
      email: 's@x.com',
      firstName: 'Student',
      lastName: 'One',
      avatarUrl: null,
      roles: [{ role: { name: ROLES.STUDENT } }],
    });

    studentProfileRepository.upsertByUserId.mockResolvedValue({
      id: 'sp1',
      tenantId: 't1',
      userId: 'u1',
      bio: 'Hello',
      githubUrl: 'https://github.com/x',
      linkedinUrl: null,
      portfolioUrl: null,
      techStack: ['NestJS'],
      updatedAt: new Date('2026-03-08T00:00:00.000Z'),
    });

    const res = await service.updateMyStudentProfile(
      { sub: 'u1', tenantId: 't1', roles: [ROLES.STUDENT] },
      { bio: 'Hello', githubUrl: 'https://github.com/x', techStack: ['NestJS'] } as any
    );

    expect(studentProfileRepository.upsertByUserId).toHaveBeenCalledWith('t1', 'u1', {
      bio: 'Hello',
      githubUrl: 'https://github.com/x',
      linkedinUrl: undefined,
      portfolioUrl: undefined,
      techStack: ['NestJS'],
    });

    expect(res.profile.techStack).toEqual(['NestJS']);
  });

  it('enforces same-tenant access for public profiles', async () => {
    authRepository.findUserById.mockResolvedValue({
      id: 's1',
      tenantId: 't2',
      deletedAt: null,
      firstName: 'S',
      lastName: 'X',
      avatarUrl: null,
      roles: [{ role: { name: ROLES.STUDENT } }],
    });

    await expect(service.getStudentPublicProfile({ tenantId: 't1' }, 's1')).rejects.toBeInstanceOf(
      InsufficientPermissionsException
    );
  });

  it('throws NotFound for non-student target', async () => {
    authRepository.findUserById.mockResolvedValue({
      id: 'u2',
      tenantId: 't1',
      deletedAt: null,
      firstName: 'U',
      lastName: 'Two',
      avatarUrl: null,
      roles: [{ role: { name: ROLES.ADVISOR } }],
    });

    await expect(service.getStudentPublicProfile({ tenantId: 't1' }, 'u2')).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it('rejects when viewer tenantId missing', async () => {
    await expect(service.getStudentPublicProfile({}, 's1')).rejects.toBeInstanceOf(
      UnauthorizedAccessException
    );
  });
});
