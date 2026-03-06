import { TenantService } from '../../src/modules/tenant/tenant.service';
import { ROLES } from '../../src/common/constants/roles.constants';

describe('TenantService.listInvitationsPaged', () => {
  const tenantRepository: any = {};

  const prisma: any = {
    user: {
      findUnique: jest.fn(),
    },
    invitation: {
      count: jest.fn(),
      findMany: jest.fn(),
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

  it('filters pending student invites vs pending faculty invites via roleNames', async () => {
    const user = {
      sub: 'dept-head-id',
      tenantId: 'tenant-id',
      roles: [ROLES.DEPARTMENT_HEAD],
    };

    prisma.user.findUnique.mockResolvedValue({ id: 'dept-head-id', departmentId: 'dept-id' });

    prisma.invitation.count.mockResolvedValue(1);
    prisma.invitation.findMany.mockResolvedValue([
      {
        id: 'inv-1',
        tenantId: 'tenant-id',
        departmentId: 'dept-id',
        email: 'student1@uni.edu',
        inviteeFirstName: 'A',
        inviteeLastName: 'B',
        status: 'PENDING',
        expiresAt: new Date('2026-03-10T00:00:00.000Z'),
        createdAt: new Date('2026-03-05T00:00:00.000Z'),
        acceptedAt: null,
        revokedAt: null,
        lastSentAt: null,
        sendCount: 0,
        lastSendError: null,
        role: { name: ROLES.STUDENT },
      },
    ]);

    const result = await service.listInvitationsPaged(user, {
      roleNames: [ROLES.STUDENT],
      page: 1,
      limit: 20,
    } as any);

    expect(prisma.invitation.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        tenantId: 'tenant-id',
        departmentId: 'dept-id',
        role: { name: { in: [ROLES.STUDENT] } },
      }),
    });

    expect(result.invitations).toHaveLength(1);
    expect(result.invitations[0].roleName).toBe(ROLES.STUDENT);
    expect(result.pagination).toEqual({ total: 1, page: 1, limit: 20, pages: 1 });
  });

  it('returns all statuses when status is omitted', async () => {
    const user = {
      sub: 'dept-head-id',
      tenantId: 'tenant-id',
      roles: [ROLES.DEPARTMENT_HEAD],
    };

    prisma.user.findUnique.mockResolvedValue({ id: 'dept-head-id', departmentId: 'dept-id' });

    prisma.invitation.count.mockResolvedValue(2);
    prisma.invitation.findMany.mockResolvedValue([]);

    await service.listInvitationsPaged(user, {
      // no status
      page: 1,
      limit: 20,
    } as any);

    expect(prisma.invitation.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        tenantId: 'tenant-id',
        departmentId: 'dept-id',
      }),
    });

    const whereArg = prisma.invitation.count.mock.calls[0][0].where;
    expect(whereArg.status).toBeUndefined();
  });

  it('rejects when caller is not DepartmentHead', async () => {
    const user = { sub: 'u', tenantId: 't', roles: [ROLES.STUDENT] };
    await expect(service.listInvitationsPaged(user, {} as any)).rejects.toBeTruthy();
  });
});
