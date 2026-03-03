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

  const cloudinaryService: any = {};
  const queueService: any = {};
  const emailService: any = {};
  const notificationService: any = {};
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
      inviteeFirstName: 'Abebe',
      inviteeLastName: 'Kebede',
      status: 'PENDING',
      expiresAt,
      lastSentAt: new Date('2026-02-19T12:00:00.000Z'),
      sendCount: 1,
      lastSendError: null,
    });

    const result = await service.createInvitation(user, {
      email: 'NewUser@uni.edu',
      firstName: 'Abebe',
      lastName: 'Kebede',
      roleName: ROLES.STUDENT,
    });

    expect(invitations.createInvitation).toHaveBeenCalledWith({
      tenantId: 'tenant-id',
      departmentId: 'dept-id',
      email: 'newuser@uni.edu',
      inviteeFirstName: 'Abebe',
      inviteeLastName: 'Kebede',
      roleName: ROLES.STUDENT,
      invitedByAdminId: 'inviter-user-id',
    });

    expect(result).toEqual({
      id: 'inv-id',
      tenantId: 'tenant-id',
      departmentId: 'dept-id',
      email: 'newuser@uni.edu',
      firstName: 'Abebe',
      lastName: 'Kebede',
      status: 'PENDING',
      expiresAt,
      lastSentAt: new Date('2026-02-19T12:00:00.000Z'),
      sendCount: 1,
      lastSendError: null,
    });
  });

  it('rejects when caller is not DepartmentHead', async () => {
    const user = { sub: 'u', tenantId: 't', roles: [ROLES.STUDENT] };
    await expect(
      service.createInvitation(user, {
        email: 'x@x.com',
        firstName: 'A',
        lastName: 'B',
        roleName: ROLES.STUDENT,
      })
    ).rejects.toBeTruthy();
  });

  it('rejects when inviter has no department', async () => {
    const user = { sub: 'u', tenantId: 't', roles: [ROLES.DEPARTMENT_HEAD] };
    prisma.user.findUnique.mockResolvedValue({ id: 'u', departmentId: null });

    await expect(
      service.createInvitation(user, {
        email: 'x@x.com',
        firstName: 'A',
        lastName: 'B',
        roleName: ROLES.STUDENT,
      })
    ).rejects.toBeTruthy();
  });

  it('rejects invalid invite role for DepartmentHead', async () => {
    const user = { sub: 'u', tenantId: 't', roles: [ROLES.DEPARTMENT_HEAD] };
    prisma.user.findUnique.mockResolvedValue({ id: 'u', departmentId: 'd' });

    await expect(
      service.createInvitation(user, {
        email: 'x@x.com',
        firstName: 'A',
        lastName: 'B',
        roleName: ROLES.PLATFORM_ADMIN as any,
      })
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
      service.createInvitation(user, {
        email: 'x@x.com',
        firstName: 'A',
        lastName: 'B',
        roleName: ROLES.STUDENT,
      })
    ).rejects.toBeTruthy();
  });
});
