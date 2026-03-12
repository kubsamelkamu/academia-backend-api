import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { DepartmentGroupSizeSettingService } from '../../src/modules/department/department-group-size-setting.service';
import { ROLES } from '../../src/common/constants/roles.constants';

describe('DepartmentGroupSizeSettingService', () => {
  const repo: any = {
    findUserDepartmentContext: jest.fn(),
    findByDepartmentId: jest.fn(),
    upsertByDepartmentId: jest.fn(),
    departmentExistsInTenant: jest.fn(),
    findDepartmentById: jest.fn(),
    findDepartmentUserIds: jest.fn(),
  };

  const notificationService: any = {
    notifyDepartmentGroupSizeUpdated: jest.fn(),
  };

  let service: DepartmentGroupSizeSettingService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new DepartmentGroupSizeSettingService(repo, notificationService);
  });

  describe('getGroupSizeSetting', () => {
    it('returns stored settings when present', async () => {
      repo.findUserDepartmentContext.mockResolvedValue({
        id: 'u1',
        tenantId: 't1',
        departmentId: 'd1',
      });
      repo.findByDepartmentId.mockResolvedValue({
        departmentId: 'd1',
        minGroupSize: 3,
        maxGroupSize: 7,
      });

      const result = await service.getGroupSizeSetting({ sub: 'u1', roles: [ROLES.COORDINATOR] });

      expect(result).toEqual({ minGroupSize: 3, maxGroupSize: 7 });
      expect(repo.findByDepartmentId).toHaveBeenCalledWith('d1');
    });

    it('returns defaults when no settings row exists', async () => {
      repo.findUserDepartmentContext.mockResolvedValue({
        id: 'u1',
        tenantId: 't1',
        departmentId: 'd1',
      });
      repo.findByDepartmentId.mockResolvedValue(null);

      const result = await service.getGroupSizeSetting({
        sub: 'u1',
        roles: [ROLES.DEPARTMENT_HEAD],
      });

      expect(result).toEqual({ minGroupSize: 3, maxGroupSize: 5 });
    });

    it('requires departmentId for platform admin if not assigned to a department', async () => {
      repo.findUserDepartmentContext.mockResolvedValue({
        id: 'admin',
        tenantId: 't1',
        departmentId: null,
      });

      await expect(
        service.getGroupSizeSetting({ sub: 'admin', roles: [ROLES.PLATFORM_ADMIN] })
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('allows platform admin to target departmentId via query', async () => {
      repo.findByDepartmentId.mockResolvedValue({
        departmentId: 'd2',
        minGroupSize: 1,
        maxGroupSize: 4,
      });

      const result = await service.getGroupSizeSetting(
        { sub: 'admin', roles: [ROLES.PLATFORM_ADMIN] },
        'd2'
      );

      expect(result).toEqual({ minGroupSize: 1, maxGroupSize: 4 });
      expect(repo.findByDepartmentId).toHaveBeenCalledWith('d2');
    });

    it('rejects department user without department assignment', async () => {
      repo.findUserDepartmentContext.mockResolvedValue({
        id: 'u1',
        tenantId: 't1',
        departmentId: null,
      });

      await expect(
        service.getGroupSizeSetting({ sub: 'u1', roles: [ROLES.COORDINATOR] })
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('updateGroupSizeSetting', () => {
    it('rejects when minGroupSize > maxGroupSize', async () => {
      await expect(
        service.updateGroupSizeSetting(
          { sub: 'u1', tenantId: 't1', roles: [ROLES.DEPARTMENT_HEAD] },
          { minGroupSize: 5, maxGroupSize: 2 } as any
        )
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('upserts and returns saved values for department user', async () => {
      repo.findUserDepartmentContext.mockResolvedValue({
        id: 'u1',
        tenantId: 't1',
        departmentId: 'd1',
      });
      repo.departmentExistsInTenant.mockResolvedValue(true);
      repo.findByDepartmentId.mockResolvedValue(null);
      repo.upsertByDepartmentId.mockResolvedValue({
        departmentId: 'd1',
        minGroupSize: 2,
        maxGroupSize: 6,
      });

      const result = await service.updateGroupSizeSetting(
        { sub: 'u1', tenantId: 't1', roles: [ROLES.DEPARTMENT_HEAD] },
        { minGroupSize: 2, maxGroupSize: 6 } as any
      );

      expect(repo.upsertByDepartmentId).toHaveBeenCalledWith(
        expect.objectContaining({
          departmentId: 'd1',
          minGroupSize: 2,
          maxGroupSize: 6,
          actorUserId: 'u1',
        })
      );
      expect(result).toEqual({ minGroupSize: 2, maxGroupSize: 6 });
    });

    it('allows platform admin update for target departmentId without tenant check', async () => {
      repo.findByDepartmentId.mockResolvedValue(null);
      repo.upsertByDepartmentId.mockResolvedValue({
        departmentId: 'd2',
        minGroupSize: 1,
        maxGroupSize: 10,
      });

      const result = await service.updateGroupSizeSetting(
        { sub: 'admin', roles: [ROLES.PLATFORM_ADMIN] },
        { minGroupSize: 1, maxGroupSize: 10 } as any,
        'd2'
      );

      expect(repo.departmentExistsInTenant).not.toHaveBeenCalled();
      expect(repo.upsertByDepartmentId).toHaveBeenCalledWith(
        expect.objectContaining({ departmentId: 'd2', actorUserId: 'admin' })
      );
      expect(result).toEqual({ minGroupSize: 1, maxGroupSize: 10 });
    });

    it('notifies all department users when values change', async () => {
      repo.findUserDepartmentContext.mockResolvedValue({
        id: 'u1',
        tenantId: 't1',
        departmentId: 'd1',
      });
      repo.departmentExistsInTenant.mockResolvedValue(true);
      repo.findByDepartmentId.mockResolvedValue({
        departmentId: 'd1',
        minGroupSize: 2,
        maxGroupSize: 6,
      });
      repo.upsertByDepartmentId.mockResolvedValue({
        departmentId: 'd1',
        minGroupSize: 3,
        maxGroupSize: 5,
      });
      repo.findDepartmentById.mockResolvedValue({ id: 'd1', tenantId: 't1', name: 'CS' });
      repo.findDepartmentUserIds.mockResolvedValue(['u1', 'u2', 'u3']);

      const result = await service.updateGroupSizeSetting(
        { sub: 'u1', tenantId: 't1', roles: [ROLES.DEPARTMENT_HEAD] },
        { minGroupSize: 3, maxGroupSize: 5 } as any
      );

      expect(result).toEqual({ minGroupSize: 3, maxGroupSize: 5 });
      expect(notificationService.notifyDepartmentGroupSizeUpdated).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 't1',
          userIds: ['u1', 'u2', 'u3'],
          departmentId: 'd1',
          departmentName: 'CS',
          minGroupSize: 3,
          maxGroupSize: 5,
          actorUserId: 'u1',
        })
      );

      expect(repo.findDepartmentUserIds).toHaveBeenCalledWith('d1', 't1');
    });

    it('does not upsert or notify when values are unchanged', async () => {
      repo.findUserDepartmentContext.mockResolvedValue({
        id: 'u1',
        tenantId: 't1',
        departmentId: 'd1',
      });
      repo.findByDepartmentId.mockResolvedValue({
        departmentId: 'd1',
        minGroupSize: 3,
        maxGroupSize: 5,
      });

      const result = await service.updateGroupSizeSetting(
        { sub: 'u1', tenantId: 't1', roles: [ROLES.DEPARTMENT_HEAD] },
        { minGroupSize: 3, maxGroupSize: 5 } as any
      );

      expect(result).toEqual({ minGroupSize: 3, maxGroupSize: 5 });
      expect(repo.upsertByDepartmentId).not.toHaveBeenCalled();
      expect(notificationService.notifyDepartmentGroupSizeUpdated).not.toHaveBeenCalled();
    });
  });
});
