import { TenantService } from '../../src/modules/tenant/tenant.service';
import { ROLES } from '../../src/common/constants/roles.constants';

describe('TenantService.createInvitation', () => {
  const tenantRepository: any = {};

  const prisma: any = {
    user: {
      findUnique: jest.fn(),
    },
  };

  const invitations: any = {
    createInvitation: jest.fn(),
  };

  let service: TenantService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new TenantService(tenantRepository, prisma, invitations);
  });

  it('creates a department-scoped invitation for DepartmentHead', async () => {
    const user = {
      sub: 'inviter-user-id',
      tenantId: 'tenant-id',
      roles: [ROLES.DEPARTMENT_HEAD],
    };

    prisma.user.findUnique.mockImplementation(async (args: any) => {
      if (args?.where?.id) {
        return { id: 'inviter-user-id', departmentId: 'dept-id' };
      }
      if (args?.where?.tenantId_email) {
        return null;
      }
      return null;
    });

    const expiresAt = new Date('2026-02-20T00:00:00.000Z');
    invitations.createInvitation.mockResolvedValue({
      id: 'inv-id',
      tenantId: 'tenant-id',
      departmentId: 'dept-id',
      email: 'newuser@uni.edu',
      status: 'PENDING',
      expiresAt,
    });

    const result = await service.createInvitation(user, {
      email: 'NewUser@uni.edu',
      roleName: ROLES.STUDENT,
    });

    expect(invitations.createInvitation).toHaveBeenCalledWith({
      tenantId: 'tenant-id',
      departmentId: 'dept-id',
      email: 'newuser@uni.edu',
      roleName: ROLES.STUDENT,
      invitedByAdminId: 'inviter-user-id',
    });

    expect(result).toEqual({
      id: 'inv-id',
      tenantId: 'tenant-id',
      departmentId: 'dept-id',
      email: 'newuser@uni.edu',
      status: 'PENDING',
      expiresAt,
    });
  });

  it('rejects when caller is not DepartmentHead', async () => {
    const user = { sub: 'u', tenantId: 't', roles: [ROLES.STUDENT] };
    await expect(
      service.createInvitation(user, { email: 'x@x.com', roleName: ROLES.STUDENT })
    ).rejects.toBeTruthy();
  });

  it('rejects when inviter has no department', async () => {
    const user = { sub: 'u', tenantId: 't', roles: [ROLES.DEPARTMENT_HEAD] };
    prisma.user.findUnique.mockResolvedValue({ id: 'u', departmentId: null });

    await expect(
      service.createInvitation(user, { email: 'x@x.com', roleName: ROLES.STUDENT })
    ).rejects.toBeTruthy();
  });

  it('rejects invalid invite role for DepartmentHead', async () => {
    const user = { sub: 'u', tenantId: 't', roles: [ROLES.DEPARTMENT_HEAD] };
    prisma.user.findUnique.mockResolvedValue({ id: 'u', departmentId: 'd' });

    await expect(
      service.createInvitation(user, { email: 'x@x.com', roleName: ROLES.PLATFORM_ADMIN as any })
    ).rejects.toBeTruthy();
  });

  it('rejects if user already exists in tenant', async () => {
    const user = { sub: 'u', tenantId: 't', roles: [ROLES.DEPARTMENT_HEAD] };

    prisma.user.findUnique.mockImplementation(async (args: any) => {
      if (args?.where?.id) {
        return { id: 'u', departmentId: 'd' };
      }
      if (args?.where?.tenantId_email) {
        return { id: 'existing' };
      }
      return null;
    });

    await expect(
      service.createInvitation(user, { email: 'x@x.com', roleName: ROLES.STUDENT })
    ).rejects.toBeTruthy();
  });
});
