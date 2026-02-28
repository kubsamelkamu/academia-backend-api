import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ROLES } from '../../common/constants/roles.constants';
import { DepartmentGroupSizeSettingRepository } from './department-group-size-setting.repository';
import { UpdateGroupSizeSettingDto } from './dto/update-group-size-setting.dto';
import { NotificationService } from '../notification/notification.service';

const DEFAULT_MIN_GROUP_SIZE = 3;
const DEFAULT_MAX_GROUP_SIZE = 5;

@Injectable()
export class DepartmentGroupSizeSettingService {
  private readonly logger = new Logger(DepartmentGroupSizeSettingService.name);

  constructor(
    private readonly departmentGroupSizeSettingRepository: DepartmentGroupSizeSettingRepository,
    private readonly notificationService: NotificationService
  ) {}

  private isPlatformAdmin(user: any): boolean {
    const roles: string[] = Array.isArray(user?.roles) ? user.roles : [];
    return roles.includes(ROLES.PLATFORM_ADMIN);
  }

  private async resolveTargetDepartmentId(user: any, departmentIdFromQuery?: string) {
    if (!user?.sub) {
      throw new ForbiddenException('Missing user context');
    }

    if (this.isPlatformAdmin(user) && departmentIdFromQuery) {
      return departmentIdFromQuery;
    }

    const userCtx = await this.departmentGroupSizeSettingRepository.findUserDepartmentContext(user.sub);
    if (!userCtx?.departmentId) {
      if (this.isPlatformAdmin(user)) {
        throw new BadRequestException('departmentId is required for platform admin');
      }
      throw new ForbiddenException('User is not assigned to a department');
    }

    return userCtx.departmentId;
  }

  async getGroupSizeSetting(user: any, departmentIdFromQuery?: string) {
    const departmentId = await this.resolveTargetDepartmentId(user, departmentIdFromQuery);

    const existing = await this.departmentGroupSizeSettingRepository.findByDepartmentId(departmentId);
    if (existing) {
      return {
        minGroupSize: existing.minGroupSize,
        maxGroupSize: existing.maxGroupSize,
      };
    }

    return {
      minGroupSize: DEFAULT_MIN_GROUP_SIZE,
      maxGroupSize: DEFAULT_MAX_GROUP_SIZE,
    };
  }

  async updateGroupSizeSetting(user: any, dto: UpdateGroupSizeSettingDto, departmentIdFromQuery?: string) {
    if (dto.minGroupSize > dto.maxGroupSize) {
      throw new BadRequestException('minGroupSize must be less than or equal to maxGroupSize');
    }

    const departmentId = await this.resolveTargetDepartmentId(user, departmentIdFromQuery);

    const existing = await this.departmentGroupSizeSettingRepository.findByDepartmentId(departmentId);
    if (
      existing &&
      existing.minGroupSize === dto.minGroupSize &&
      existing.maxGroupSize === dto.maxGroupSize
    ) {
      return {
        minGroupSize: existing.minGroupSize,
        maxGroupSize: existing.maxGroupSize,
      };
    }

    // If not platform admin, ensure department belongs to same tenant.
    if (!this.isPlatformAdmin(user)) {
      const tenantId: string | undefined = user?.tenantId;
      if (!tenantId) {
        throw new ForbiddenException('Missing tenant context');
      }

      const ok = await this.departmentGroupSizeSettingRepository.departmentExistsInTenant(departmentId, tenantId);
      if (!ok) {
        throw new ForbiddenException('Department not found for tenant');
      }
    }

    const saved = await this.departmentGroupSizeSettingRepository.upsertByDepartmentId({
      departmentId,
      minGroupSize: dto.minGroupSize,
      maxGroupSize: dto.maxGroupSize,
      actorUserId: user?.sub,
    });

    // Best-effort notifications (do not block config update)
    try {
      const department = await this.departmentGroupSizeSettingRepository.findDepartmentById(departmentId);
      if (!department) {
        this.logger.warn(`GroupSizeNotification: department not found (${departmentId})`);
      } else if (!department.tenantId) {
        this.logger.warn(`GroupSizeNotification: department has no tenantId (${departmentId})`);
      } else {
        const userIds = await this.departmentGroupSizeSettingRepository.findDepartmentUserIds(
          departmentId,
          department.tenantId
        );

        this.logger.log(
          `GroupSizeNotification: notifying ${userIds.length} users for department ${departmentId}`
        );

        if (userIds.length === 0) {
          this.logger.warn(
            `GroupSizeNotification: no recipients found (departmentId=${departmentId}, tenantId=${department.tenantId})`
          );
        }

        await this.notificationService.notifyDepartmentGroupSizeUpdated({
          tenantId: department.tenantId,
          userIds,
          departmentId,
          departmentName: department.name ?? undefined,
          minGroupSize: saved.minGroupSize,
          maxGroupSize: saved.maxGroupSize,
          actorUserId: user?.sub,
        });
      }
    } catch (err: any) {
      this.logger.warn(`GroupSizeNotification: failed (${err?.message ?? 'unknown error'})`);
    }

    return {
      minGroupSize: saved.minGroupSize,
      maxGroupSize: saved.maxGroupSize,
    };
  }
}
