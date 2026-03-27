import { AuthService } from '../../src/modules/auth/auth.service';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));

import * as bcrypt from 'bcrypt';

describe('AuthService login (tenant inference)', () => {
  const authRepository: any = {
    // tenant inference path
    findUserByEmailGlobally: jest.fn(),
    findTenantById: jest.fn(),

    // actual validation
    findUserByEmailAndTenant: jest.fn(),
    updateUserFirstLoginAndDeadline: jest.fn(),
    updateUserLastLogin: jest.fn(),
  };

  const jwtService: any = {
    sign: jest.fn(),
  };

  const configService: any = {
    get: jest.fn(),
    getOrThrow: jest.fn(),
  };

  const queueService: any = {};
  const emailService: any = {};
  const notificationService: any = {};

  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();

    jwtService.sign.mockReturnValue('jwt');
    configService.getOrThrow.mockReturnValue('refresh-secret');

    service = new AuthService(
      authRepository,
      jwtService,
      configService,
      queueService,
      emailService,
      notificationService
    );
  });

  it('logs in a tenant user without tenantDomain by inferring tenant from email', async () => {
    authRepository.findUserByEmailGlobally.mockResolvedValue({
      id: 'u1',
      email: 'depthead@uni.edu',
      tenantId: 't1',
    });

    authRepository.findTenantById.mockResolvedValue({
      id: 't1',
      domain: 'uni',
      status: 'ACTIVE',
    });

    authRepository.findUserByEmailAndTenant.mockResolvedValue({
      id: 'u1',
      tenantId: 't1',
      departmentId: 'd1',
      email: 'depthead@uni.edu',
      hashedPassword: 'hash',
      status: 'ACTIVE',
      firstName: 'Dept',
      lastName: 'Head',
      avatarUrl: null,
      tenant: { id: 't1', domain: 'uni', status: 'ACTIVE' },
      roles: [{ role: { name: 'DepartmentHead' } }],
    });

    (bcrypt.compare as unknown as jest.Mock).mockResolvedValue(true);

    const result = await service.login({
      email: 'depthead@uni.edu',
      password: 'Password123!',
      // tenantDomain intentionally omitted
    });

    expect(authRepository.findUserByEmailGlobally).toHaveBeenCalledWith('depthead@uni.edu');
    expect(authRepository.findTenantById).toHaveBeenCalledWith('t1');
    expect(authRepository.findUserByEmailAndTenant).toHaveBeenCalledWith('depthead@uni.edu', 't1');

    expect(result).toEqual({
      accessToken: 'jwt',
      refreshToken: 'jwt',
      user: {
        id: 'u1',
        email: 'depthead@uni.edu',
        firstName: 'Dept',
        lastName: 'Head',
        avatarUrl: null,
        roles: ['DepartmentHead'],
        tenantId: 't1',
        mustChangePassword: false,
      },
    });

    expect(jwtService.sign).toHaveBeenCalledWith({
      sub: 'u1',
      email: 'depthead@uni.edu',
      tenantId: 't1',
      departmentId: 'd1',
      roles: ['DepartmentHead'],
    });
  });
});
