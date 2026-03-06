import { TenantService } from '../../src/modules/tenant/tenant.service';
import { ROLES } from '../../src/common/constants/roles.constants';

describe('TenantService.listDepartmentUsersPaged', () => {
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

  it('supports role filter (STUDENT) with pagination + search', async () => {
    const user = {
      sub: 'dept-head-id',
      tenantId: 'tenant-id',
      roles: [ROLES.DEPARTMENT_HEAD],
    };

    prisma.user.findUnique.mockResolvedValue({ departmentId: 'dept-id' });

    tenantRepository.countDepartmentUsers.mockResolvedValue(1);
    tenantRepository.findDepartmentUsers.mockResolvedValue([
      { id: 's1', roles: [{ role: { name: ROLES.STUDENT } }] },
    ]);

    const result = await service.listDepartmentUsersPaged(user, {
      page: 2,
      limit: 10,
      search: 'stu',
      roleNames: [ROLES.STUDENT],
    } as any);

    expect(tenantRepository.countDepartmentUsers).toHaveBeenCalledWith({
      tenantId: 'tenant-id',
      departmentId: 'dept-id',
      roleNames: [ROLES.STUDENT],
      search: 'stu',
    });

    expect(tenantRepository.findDepartmentUsers).toHaveBeenCalledWith({
      tenantId: 'tenant-id',
      departmentId: 'dept-id',
      roleNames: [ROLES.STUDENT],
      search: 'stu',
      skip: 10,
      take: 10,
    });

    expect(result).toEqual({
      users: [{ id: 's1', roles: [{ role: { name: ROLES.STUDENT } }] }],
      pagination: { total: 1, page: 2, limit: 10, pages: 1 },
    });
  });

  it('rejects when caller is not DepartmentHead', async () => {
    const user = { sub: 'u', tenantId: 't', roles: [ROLES.STUDENT] };
    await expect(service.listDepartmentUsersPaged(user, {} as any)).rejects.toBeTruthy();
  });
});
