import { Injectable } from '@nestjs/common';
import { ProjectStatus, TenantStatus, UserStatus } from '@prisma/client';
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
    };

    const [totalStudents, totalAdvisors, totalActiveProjects, totalCompletedProjects] =
      await Promise.all([
        this.prisma.student.count({
          where: {
            tenant: activeTenantWhere,
            user: activeUserWhere,
          },
        }),
        this.prisma.advisor.count({
          where: {
            user: {
              ...activeUserWhere,
              tenant: activeTenantWhere,
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
