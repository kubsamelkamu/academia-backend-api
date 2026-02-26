import { BadRequestException } from '@nestjs/common';
import { TenantService } from '../../src/modules/tenant/tenant.service';
import { ROLES } from '../../src/common/constants/roles.constants';

describe('TenantService.submitVerificationDocument', () => {
  const baseUser = {
    sub: 'user-1',
    tenantId: 'tenant-1',
    roles: [ROLES.DEPARTMENT_HEAD],
  };

  const makeService = (overrides?: {
    prisma?: any;
    cloudinaryService?: any;
    queueService?: any;
    emailService?: any;
    notificationService?: any;
    configService?: any;
  }) => {
    const tenantRepository = {} as any;
    const invitations = {} as any;

    const prisma =
      overrides?.prisma ??
      ({
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: baseUser.sub,
            tenantId: baseUser.tenantId,
            email: 'head@uni.edu',
            firstName: 'Dept',
            lastName: 'Head',
            emailVerified: true,
          }),
        },
        tenant: {
          findUnique: jest.fn().mockResolvedValue({
            id: baseUser.tenantId,
            name: 'My University',
            domain: 'myuniversity',
          }),
        },
        tenantVerificationRequest: {
          create: jest.fn().mockResolvedValue({
            id: 'req-1',
            tenantId: baseUser.tenantId,
            submittedByUserId: baseUser.sub,
            status: 'PENDING',
            documentUrl: 'https://example.com/doc.pdf',
            fileName: 'doc.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 123,
            createdAt: new Date('2026-02-25T00:00:00.000Z'),
          }),
        },
      } as any);

    const cloudinaryService =
      overrides?.cloudinaryService ??
      ({
        uploadTenantVerificationDocument: jest.fn().mockResolvedValue({
          secureUrl: 'https://example.com/doc.pdf',
          publicId: 'tenant-verification/tenant-1/user-1/abc',
          resourceType: 'raw',
        }),
        deleteByPublicId: jest.fn().mockResolvedValue(undefined),
      } as any);

    const queueService =
      overrides?.queueService ??
      ({
        addTransactionalEmailJob: jest.fn().mockResolvedValue(undefined),
      } as any);

    const emailService = overrides?.emailService ?? ({ sendTransactionalEmail: jest.fn() } as any);

    const notificationService =
      overrides?.notificationService ??
      ({
        notifyInstitutionVerificationSubmitted: jest.fn().mockResolvedValue(undefined),
        notifyPlatformAdminsInstitutionVerificationSubmitted: jest.fn().mockResolvedValue(undefined),
      } as any);

    const configService =
      overrides?.configService ??
      ({
        get: jest.fn((key: string) => {
          if (key === 'email.supportEmail') return 'support@academia.et';
          return undefined;
        }),
      } as any);

    const service = new TenantService(
      tenantRepository,
      prisma,
      invitations,
      cloudinaryService,
      queueService,
      emailService,
      notificationService,
      configService
    );

    return {
      service,
      prisma,
      cloudinaryService,
      queueService,
      emailService,
      notificationService,
      configService,
    };
  };

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.WORKER = 'true';
    process.env.NODE_ENV = 'test';
  });

  it('creates a PENDING verification request and queues emails', async () => {
    const { service, queueService, notificationService } = makeService();

    const file = {
      buffer: Buffer.from('file'),
      mimetype: 'application/pdf',
      originalname: 'proof.pdf',
      size: 2048,
    } as any;

    const result = await service.submitVerificationDocument(baseUser, file);

    expect(result).toMatchObject({
      id: 'req-1',
      status: 'PENDING',
      mimeType: 'application/pdf',
    });

    expect(queueService.addTransactionalEmailJob).toHaveBeenCalledTimes(2);
    expect(notificationService.notifyInstitutionVerificationSubmitted).toHaveBeenCalledTimes(1);
    expect(
      notificationService.notifyPlatformAdminsInstitutionVerificationSubmitted
    ).toHaveBeenCalledTimes(1);
  });

  it('rejects when email is not verified', async () => {
    const { service } = makeService({
      prisma: {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: baseUser.sub,
            tenantId: baseUser.tenantId,
            email: 'head@uni.edu',
            firstName: 'Dept',
            lastName: 'Head',
            emailVerified: false,
          }),
        },
        tenant: { findUnique: jest.fn() },
        tenantVerificationRequest: { create: jest.fn() },
      },
    });

    const file = {
      buffer: Buffer.from('file'),
      mimetype: 'application/pdf',
      originalname: 'proof.pdf',
      size: 2048,
    } as any;

    await expect(service.submitVerificationDocument(baseUser, file)).rejects.toThrow(
      BadRequestException
    );
  });

  it('cleans up the uploaded file if DB create fails', async () => {
    const { service, cloudinaryService } = makeService({
      prisma: {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: baseUser.sub,
            tenantId: baseUser.tenantId,
            email: 'head@uni.edu',
            firstName: 'Dept',
            lastName: 'Head',
            emailVerified: true,
          }),
        },
        tenant: { findUnique: jest.fn().mockResolvedValue({ id: baseUser.tenantId }) },
        tenantVerificationRequest: {
          create: jest.fn().mockRejectedValue(new Error('DB down')),
        },
      },
    });

    const file = {
      buffer: Buffer.from('file'),
      mimetype: 'application/pdf',
      originalname: 'proof.pdf',
      size: 2048,
    } as any;

    await expect(service.submitVerificationDocument(baseUser, file)).rejects.toThrow('DB down');

    expect(cloudinaryService.deleteByPublicId).toHaveBeenCalledTimes(1);
  });
});
