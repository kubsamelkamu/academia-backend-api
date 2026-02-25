import { ConflictException, NotFoundException } from '@nestjs/common';
import { AdminTenantVerificationService } from '../../src/modules/admin/tenant-verification/admin-tenant-verification.service';
import { ROLES } from '../../src/common/constants/roles.constants';
import { TenantVerificationStatus } from '@prisma/client';

describe('AdminTenantVerificationService', () => {
  const adminUser = { sub: 'admin-1', roles: [ROLES.PLATFORM_ADMIN] };

  const makeService = (overrides?: {
    prisma?: any;
    queueService?: any;
    emailService?: any;
    notificationService?: any;
    configService?: any;
  }) => {
    const prisma =
      overrides?.prisma ??
      ({
        $transaction: jest.fn(async (ops: any[]) => Promise.all(ops)),
        tenantVerificationRequest: {
          findMany: jest.fn().mockResolvedValue([]),
          count: jest.fn().mockResolvedValue(0),
          findUnique: jest.fn(),
          updateMany: jest.fn(),
        },
      } as any);

    const queueService =
      overrides?.queueService ??
      ({ addTransactionalEmailJob: jest.fn().mockResolvedValue(undefined) } as any);

    const emailService = overrides?.emailService ?? ({ sendTransactionalEmail: jest.fn() } as any);

    const notificationService =
      overrides?.notificationService ??
      ({
        notifyInstitutionVerificationApproved: jest.fn().mockResolvedValue(undefined),
        notifyInstitutionVerificationRejected: jest.fn().mockResolvedValue(undefined),
      } as any);

    const configService = overrides?.configService ?? ({ get: jest.fn() } as any);
    configService.get.mockImplementation((key: string) => {
      if (key === 'email.supportEmail') return 'support@academia.et';
      return undefined;
    });

    const service = new AdminTenantVerificationService(
      prisma,
      queueService,
      emailService,
      notificationService,
      configService
    );
    return { service, prisma, queueService, emailService, notificationService, configService };
  };

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.WORKER = 'true';
    process.env.NODE_ENV = 'test';
  });

  it('approves a PENDING request', async () => {
    const { service, prisma, queueService, notificationService } = makeService();

    prisma.tenantVerificationRequest.updateMany.mockResolvedValue({ count: 1 });
    prisma.tenantVerificationRequest.findUnique.mockResolvedValue({
      id: 'req-1',
      status: TenantVerificationStatus.APPROVED,
      tenantId: 'tenant-1',
      submittedByUserId: 'user-1',
      documentUrl: 'https://example.com/doc.pdf',
      documentPublicId: 'pid',
      fileName: 'doc.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 100,
      reviewedByUserId: adminUser.sub,
      reviewedAt: new Date(),
      reviewReason: 'ok',
      createdAt: new Date(),
      updatedAt: new Date(),
      tenant: { id: 'tenant-1', name: 'T', domain: 't', status: 'ACTIVE' },
      submittedBy: { id: 'user-1', email: 'u@t.com', firstName: 'U', lastName: 'T' },
      reviewedBy: { id: adminUser.sub, email: 'a@t.com', firstName: 'A', lastName: 'T' },
    });

    const result = await service.approveRequest(adminUser, 'req-1', 'ok');

    expect(prisma.tenantVerificationRequest.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'req-1', status: TenantVerificationStatus.PENDING },
        data: expect.objectContaining({
          status: TenantVerificationStatus.APPROVED,
          reviewedByUserId: adminUser.sub,
        }),
      })
    );

    expect(result.status).toBe(TenantVerificationStatus.APPROVED);

    // Dept head + support audit email
    expect(queueService.addTransactionalEmailJob).toHaveBeenCalledTimes(2);
    expect(notificationService.notifyInstitutionVerificationApproved).toHaveBeenCalledTimes(1);
  });

  it('rejects a PENDING request', async () => {
    const { service, prisma, queueService, notificationService } = makeService();

    prisma.tenantVerificationRequest.updateMany.mockResolvedValue({ count: 1 });
    prisma.tenantVerificationRequest.findUnique.mockResolvedValue({
      id: 'req-2',
      status: TenantVerificationStatus.REJECTED,
      tenantId: 'tenant-1',
      submittedByUserId: 'user-1',
      documentUrl: 'https://example.com/doc.pdf',
      documentPublicId: 'pid',
      fileName: 'doc.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 100,
      reviewedByUserId: adminUser.sub,
      reviewedAt: new Date(),
      reviewReason: 'not valid',
      createdAt: new Date(),
      updatedAt: new Date(),
      tenant: { id: 'tenant-1', name: 'T', domain: 't', status: 'ACTIVE' },
      submittedBy: { id: 'user-1', email: 'u@t.com', firstName: 'U', lastName: 'T' },
      reviewedBy: { id: adminUser.sub, email: 'a@t.com', firstName: 'A', lastName: 'T' },
    });

    const result = await service.rejectRequest(adminUser, 'req-2', 'not valid');

    expect(result.status).toBe(TenantVerificationStatus.REJECTED);
    expect(result.reviewReason).toBe('not valid');

    // Dept head + support audit email
    expect(queueService.addTransactionalEmailJob).toHaveBeenCalledTimes(2);
    expect(notificationService.notifyInstitutionVerificationRejected).toHaveBeenCalledTimes(1);
  });

  it('throws NotFound when approving a missing request', async () => {
    const { service, prisma } = makeService();

    prisma.tenantVerificationRequest.updateMany.mockResolvedValue({ count: 0 });
    prisma.tenantVerificationRequest.findUnique.mockResolvedValue(null);

    await expect(service.approveRequest(adminUser, 'missing', undefined)).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it('throws Conflict when approving an already-reviewed request', async () => {
    const { service, prisma } = makeService();

    prisma.tenantVerificationRequest.updateMany.mockResolvedValue({ count: 0 });
    prisma.tenantVerificationRequest.findUnique.mockResolvedValue({
      id: 'req-3',
      status: TenantVerificationStatus.REJECTED,
    });

    await expect(service.approveRequest(adminUser, 'req-3', undefined)).rejects.toBeInstanceOf(
      ConflictException
    );
  });
});
