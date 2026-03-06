import { TenantService } from '../../src/modules/tenant/tenant.service';
import { ROLES } from '../../src/common/constants/roles.constants';

describe('TenantService.listFaculty', () => {
  const tenantRepository: any = {
    countDepartmentUsers: jest.fn(),
    findDepartmentUsers: jest.fn(),
  };

  const prisma: any = {
    user: {
      findUnique: jest.fn(),
    },
  };

  const invitations: any = {};
  const cloudinaryService: any = {};
  const queueService: any = {};
  const emailService: any = {};
  const notificationService: any = { createNotification: jest.fn() };
  const configService: any = { get: jest.fn() };

  let service: TenantService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new TenantService(
      tenantRepository,
      prisma,
      invitations,
      cloudinaryService,
      queueService,
      emailService,
      notificationService,
      configService
    );
  });

  it('returns paginated advisors+coordinators in the caller department', async () => {
    const user = {
      sub: 'dept-head-id',
      tenantId: 'tenant-id',
      roles: [ROLES.DEPARTMENT_HEAD],
    };

    prisma.user.findUnique.mockResolvedValue({ departmentId: 'dept-id' });

    tenantRepository.countDepartmentUsers.mockResolvedValue(2);
    tenantRepository.findDepartmentUsers.mockResolvedValue([
      { id: 'u1', roles: [{ role: { name: ROLES.ADVISOR } }] },
      { id: 'u2', roles: [{ role: { name: ROLES.COORDINATOR } }] },
    ]);

    const result = await service.listFaculty(user, { page: 1, limit: 20, search: 'ab' } as any);

    expect(tenantRepository.countDepartmentUsers).toHaveBeenCalledWith({
      tenantId: 'tenant-id',
      departmentId: 'dept-id',
      roleNames: [ROLES.ADVISOR, ROLES.COORDINATOR],
      search: 'ab',
    });

    expect(tenantRepository.findDepartmentUsers).toHaveBeenCalledWith({
      tenantId: 'tenant-id',
      departmentId: 'dept-id',
      roleNames: [ROLES.ADVISOR, ROLES.COORDINATOR],
      search: 'ab',
      skip: 0,
      take: 20,
    });

    expect(result).toEqual({
      users: [
        { id: 'u1', roles: [{ role: { name: ROLES.ADVISOR } }] },
        { id: 'u2', roles: [{ role: { name: ROLES.COORDINATOR } }] },
      ],
      pagination: { total: 2, page: 1, limit: 20, pages: 1 },
    });
  });

  it('rejects when caller is not DepartmentHead', async () => {
    const user = { sub: 'u', tenantId: 't', roles: [ROLES.STUDENT] };
    await expect(service.listFaculty(user, {} as any)).rejects.toBeTruthy();
  });

  it('rejects when caller has no department', async () => {
    const user = { sub: 'u', tenantId: 't', roles: [ROLES.DEPARTMENT_HEAD] };
    prisma.user.findUnique.mockResolvedValue({ departmentId: null });

    await expect(service.listFaculty(user, {} as any)).rejects.toBeTruthy();
  });
});
