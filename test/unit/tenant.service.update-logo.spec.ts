import { TenantService } from '../../src/modules/tenant/tenant.service';
import { ROLES } from '../../src/common/constants/roles.constants';

describe('TenantService.updateTenantLogo', () => {
  const tenantRepository: any = {
    findTenantById: jest.fn(),
    updateTenantConfig: jest.fn(),
  };

  const prisma: any = {};
  const invitations: any = {};

  const cloudinaryService: any = {
    uploadTenantLogo: jest.fn(),
    deleteByPublicId: jest.fn(),
  };

  const queueService: any = {};
  const emailService: any = {};
  const notificationService: any = {
    notifyInstitutionLogoUpdated: jest.fn(),
  };
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

  it('uploads logo and stores it in tenant.config.branding', async () => {
    const user = {
      sub: 'dept-head-id',
      tenantId: 'tenant-id',
      roles: [ROLES.DEPARTMENT_HEAD],
    };

    tenantRepository.findTenantById.mockResolvedValue({
      id: 'tenant-id',
      name: 'Test University',
      domain: 'test.edu',
      status: 'ACTIVE',
      config: {
        createdByUserId: 'creator-id',
        createdBy: { userId: 'creator-id', email: 'creator@test.edu' },
        policies: { dataRetention: 365 },
        branding: { theme: 'default' },
      },
    });

    cloudinaryService.uploadTenantLogo.mockResolvedValue({
      secureUrl: 'https://cdn.example.com/logo.webp',
      publicId: 'academic-platform/tenants/logos/tenant_logo_tenant-id',
    });

    tenantRepository.updateTenantConfig.mockResolvedValue({ id: 'tenant-id', config: {} });

    await service.updateTenantLogo(user, {
      buffer: Buffer.from('fake'),
      mimetype: 'image/png',
      originalname: 'logo.png',
    } as any);

    expect(cloudinaryService.uploadTenantLogo).toHaveBeenCalledWith({
      tenantId: 'tenant-id',
      buffer: expect.any(Buffer),
    });

    expect(tenantRepository.updateTenantConfig).toHaveBeenCalledWith(
      'tenant-id',
      expect.objectContaining({
        policies: { dataRetention: 365 },
        createdByUserId: 'creator-id',
        createdBy: { userId: 'creator-id', email: 'creator@test.edu' },
        branding: {
          theme: 'default',
          logoUrl: 'https://cdn.example.com/logo.webp',
          logoPublicId: 'academic-platform/tenants/logos/tenant_logo_tenant-id',
        },
      })
    );

    expect(notificationService.notifyInstitutionLogoUpdated).toHaveBeenCalledWith({
      tenantId: 'tenant-id',
      userId: 'dept-head-id',
      tenantName: 'Test University',
      logoUrl: 'https://cdn.example.com/logo.webp',
      isFirstSet: true,
    });
  });

  it('emits logo updated notification with isFirstSet=false when a logo already exists', async () => {
    const user = {
      sub: 'dept-head-id',
      tenantId: 'tenant-id',
      roles: [ROLES.DEPARTMENT_HEAD],
    };

    tenantRepository.findTenantById.mockResolvedValue({
      id: 'tenant-id',
      name: 'Test University',
      domain: 'test.edu',
      status: 'ACTIVE',
      config: {
        branding: {
          theme: 'default',
          logoUrl: 'https://cdn.example.com/old-logo.webp',
          logoPublicId: 'academic-platform/tenants/logos/tenant_logo_tenant-id',
        },
      },
    });

    cloudinaryService.uploadTenantLogo.mockResolvedValue({
      secureUrl: 'https://cdn.example.com/new-logo.webp',
      publicId: 'academic-platform/tenants/logos/tenant_logo_tenant-id',
    });

    tenantRepository.updateTenantConfig.mockResolvedValue({ id: 'tenant-id', config: {} });

    await service.updateTenantLogo(user, {
      buffer: Buffer.from('fake'),
      mimetype: 'image/png',
      originalname: 'logo.png',
    } as any);

    expect(notificationService.notifyInstitutionLogoUpdated).toHaveBeenCalledWith({
      tenantId: 'tenant-id',
      userId: 'dept-head-id',
      tenantName: 'Test University',
      logoUrl: 'https://cdn.example.com/new-logo.webp',
      isFirstSet: false,
    });
  });

  it('rejects non DepartmentHead / PlatformAdmin', async () => {
    const user = {
      sub: 'user-id',
      tenantId: 'tenant-id',
      roles: [ROLES.STUDENT],
    };

    await expect(
      service.updateTenantLogo(user, { buffer: Buffer.from('x') } as any)
    ).rejects.toThrow('Insufficient permissions');
  });
});
