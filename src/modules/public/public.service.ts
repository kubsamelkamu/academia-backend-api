import { Injectable } from '@nestjs/common';
import { ProjectStatus, TenantStatus, UserStatus } from '@prisma/client';
import { ROLES } from '../../common/constants/roles.constants';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PublicService {
  constructor(private readonly prisma: PrismaService) {}

  async getPlatformStats() {
    const activeTenantStatuses: TenantStatus[] = [TenantStatus.ACTIVE, TenantStatus.TRIAL];
    const activeTenantWhere = {
      is: {
        status: { in: activeTenantStatuses },
      },
    };

    const activeUserWhere = {
      status: UserStatus.ACTIVE,
      deletedAt: null,
      tenant: activeTenantWhere,
    };

    const [totalStudents, totalAdvisors, totalActiveProjects, totalCompletedProjects] =
      await Promise.all([
        this.prisma.user.count({
          where: {
            ...activeUserWhere,
            roles: {
              some: {
                revokedAt: null,
                role: {
                  name: ROLES.STUDENT,
                },
              },
            },
          },
        }),
        this.prisma.user.count({
          where: {
            ...activeUserWhere,
            roles: {
              some: {
                revokedAt: null,
                role: {
                  name: ROLES.ADVISOR,
                },
              },
            },
          },
        }),
        this.prisma.project.count({
          where: {
            tenant: activeTenantWhere,
            status: ProjectStatus.ACTIVE,
          },
        }),
        this.prisma.project.count({
          where: {
            tenant: activeTenantWhere,
            status: ProjectStatus.COMPLETED,
          },
        }),
      ]);

    return {
      totalStudents,
      totalAdvisors,
      totalActiveProjects,
      totalCompletedProjects,
    };
  }
}
