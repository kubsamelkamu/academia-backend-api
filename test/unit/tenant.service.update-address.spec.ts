import { TenantService } from '../../src/modules/tenant/tenant.service';
import { ROLES } from '../../src/common/constants/roles.constants';

describe('TenantService.updateTenantAddress', () => {
  const tenantRepository: any = {
    findTenantById: jest.fn(),
    updateTenantConfig: jest.fn(),
  };

  const prisma: any = {};
  const invitations: any = {};
  const cloudinaryService: any = {};
  const queueService: any = {};
  const emailService: any = {};
  const notificationService: any = {
    notifyInstitutionAddressUpdated: jest.fn(),
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

  it('merges into tenant.config.address without overwriting other config', async () => {
    const user = {
      sub: 'dept-head-id',
      tenantId: 'tenant-id',
      roles: [ROLES.DEPARTMENT_HEAD],
    };

    tenantRepository.findTenantById.mockResolvedValue({
      id: 'tenant-id',
      name: 'Test University',
      domain: 'test.edu',
      status: 'TRIAL',
      config: {
        createdByUserId: 'creator-id',
        createdBy: { userId: 'creator-id', email: 'creator@test.edu' },
        policies: { dataRetention: 365 },
        address: { country: 'Ethiopia', city: 'Addis Ababa' },
      },
    });

    tenantRepository.updateTenantConfig.mockResolvedValue({
      id: 'tenant-id',
      config: {},
    });

    await service.updateTenantAddress(user, {
      city: '  Haramaya  ',
      region: ' Oromia ',
      phone: ' 2345678 ',
      website: ' http:web.com ',
    } as any);

    expect(tenantRepository.updateTenantConfig).toHaveBeenCalledWith(
      'tenant-id',
      expect.objectContaining({
        policies: { dataRetention: 365 },
        createdByUserId: 'creator-id',
        createdBy: { userId: 'creator-id', email: 'creator@test.edu' },
        address: {
          country: 'Ethiopia',
          city: 'Haramaya',
          region: 'Oromia',
          phone: '2345678',
          website: 'http:web.com',
        },
      })
    );

    // Address already existed, so notification fires as an "update" (not first set).
    expect(notificationService.notifyInstitutionAddressUpdated).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-id',
        userId: 'dept-head-id',
        tenantName: 'Test University',
        isFirstSet: false,
      })
    );
  });

  it('sends onboarding notification when address is set first time', async () => {
    const user = {
      sub: 'dept-head-id',
      tenantId: 'tenant-id',
      roles: [ROLES.DEPARTMENT_HEAD],
    };

    tenantRepository.findTenantById.mockResolvedValue({
      id: 'tenant-id',
      name: 'Test University',
      domain: 'test.edu',
      status: 'TRIAL',
      config: {
        createdByUserId: 'creator-id',
        policies: { dataRetention: 365 },
      },
    });

    tenantRepository.updateTenantConfig.mockResolvedValue({ id: 'tenant-id', config: {} });

    await service.updateTenantAddress(user, {
      city: 'Addis Ababa',
    } as any);

    expect(notificationService.notifyInstitutionAddressUpdated).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-id',
        userId: 'dept-head-id',
        tenantName: 'Test University',
        isFirstSet: true,
      })
    );
  });

  it('rejects non DepartmentHead / PlatformAdmin', async () => {
    const user = {
      sub: 'user-id',
      tenantId: 'tenant-id',
      roles: [ROLES.STUDENT],
    };

    await expect(
      service.updateTenantAddress(user, { city: 'Addis' } as any)
    ).rejects.toThrow('Insufficient permissions');
  });
});
