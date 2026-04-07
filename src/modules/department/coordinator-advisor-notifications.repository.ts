import { Injectable } from '@nestjs/common';
import {
  CoordinatorAdvisorNotificationDeliveryMethod,
  NotificationSeverity,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CoordinatorAdvisorNotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get prismaClient(): any {
    return this.prisma as any;
  }

  async findUserDepartmentContext(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        tenantId: true,
        departmentId: true,
      },
    });
  }

  async departmentExistsInTenant(departmentId: string, tenantId: string) {
    const department = await this.prisma.department.findFirst({
      where: {
        id: departmentId,
        tenantId,
      },
      select: { id: true },
    });

    return Boolean(department);
  }

  async findDepartmentAdvisors(params: {
    tenantId: string;
    departmentId: string;
    advisorUserIds?: string[];
  }) {
    return this.prisma.advisor.findMany({
      where: {
        departmentId: params.departmentId,
        ...(params.advisorUserIds?.length ? { userId: { in: params.advisorUserIds } } : {}),
        user: {
          tenantId: params.tenantId,
          deletedAt: null,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            status: true,
          },
        },
      },
      orderBy: [{ user: { firstName: 'asc' } }, { user: { lastName: 'asc' } }],
    });
  }

  async createCampaignWithRecipients(params: {
    tenantId: string;
    departmentId: string;
    createdByUserId: string;
    recipientMode: any;
    deliveryMethod: CoordinatorAdvisorNotificationDeliveryMethod;
    priority: NotificationSeverity;
    subject: string;
    message: string;
    recipients: Array<{
      advisorUserId: string;
      email: string;
      fullName: string;
    }>;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const campaign = await (tx as any).coordinatorAdvisorNotificationCampaign.create({
        data: {
          tenantId: params.tenantId,
          departmentId: params.departmentId,
          createdByUserId: params.createdByUserId,
          recipientMode: params.recipientMode,
          deliveryMethod: params.deliveryMethod,
          priority: params.priority,
          subject: params.subject,
          message: params.message,
          requestedRecipientsCount: params.recipients.length,
          totalReachedCount: params.recipients.length,
        },
      });

      if (params.recipients.length > 0) {
        await (tx as any).coordinatorAdvisorNotificationRecipient.createMany({
          data: params.recipients.map((recipient) => ({
            campaignId: campaign.id,
            tenantId: params.tenantId,
            departmentId: params.departmentId,
            advisorUserId: recipient.advisorUserId,
            email: recipient.email,
            fullName: recipient.fullName,
          })),
        });
      }

      return campaign;
    });
  }

  async updateRecipientDelivery(params: {
    campaignId: string;
    advisorUserId: string;
    inAppStatus?: any;
    emailStatus?: any;
    inAppNotificationId?: string | null;
    emailProviderMessageId?: string | null;
    emailFailureReason?: string | null;
  }) {
    return this.prismaClient.coordinatorAdvisorNotificationRecipient.update({
      where: {
        campaignId_advisorUserId: {
          campaignId: params.campaignId,
          advisorUserId: params.advisorUserId,
        },
      },
      data: {
        ...(params.inAppStatus ? { inAppStatus: params.inAppStatus } : {}),
        ...(params.emailStatus ? { emailStatus: params.emailStatus } : {}),
        ...(params.inAppNotificationId !== undefined
          ? { inAppNotificationId: params.inAppNotificationId }
          : {}),
        ...(params.emailProviderMessageId !== undefined
          ? { emailProviderMessageId: params.emailProviderMessageId }
          : {}),
        ...(params.emailFailureReason !== undefined
          ? { emailFailureReason: params.emailFailureReason }
          : {}),
      },
    });
  }

  async updateCampaignCounts(params: {
    campaignId: string;
    inAppDeliveredCount: number;
    inAppFailedCount: number;
    emailQueuedCount: number;
    emailAcceptedCount: number;
    emailDeliveredCount: number;
    emailFailedCount: number;
  }) {
    return this.prismaClient.coordinatorAdvisorNotificationCampaign.update({
      where: { id: params.campaignId },
      data: {
        inAppDeliveredCount: params.inAppDeliveredCount,
        inAppFailedCount: params.inAppFailedCount,
        emailQueuedCount: params.emailQueuedCount,
        emailAcceptedCount: params.emailAcceptedCount,
        emailDeliveredCount: params.emailDeliveredCount,
        emailFailedCount: params.emailFailedCount,
      },
    });
  }

  async listCampaignsPaged(params: {
    tenantId: string;
    departmentId: string;
    skip: number;
    take: number;
    deliveryMethod?: CoordinatorAdvisorNotificationDeliveryMethod;
    priority?: NotificationSeverity;
    search?: string;
  }) {
    const where = {
      tenantId: params.tenantId,
      departmentId: params.departmentId,
      ...(params.deliveryMethod ? { deliveryMethod: params.deliveryMethod } : {}),
      ...(params.priority ? { priority: params.priority } : {}),
      ...(params.search
        ? {
            OR: [
              { subject: { contains: params.search, mode: 'insensitive' as const } },
              { message: { contains: params.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prismaClient.coordinatorAdvisorNotificationCampaign.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip: params.skip,
        take: params.take,
        include: {
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
        },
      }),
      this.prismaClient.coordinatorAdvisorNotificationCampaign.count({ where }),
    ]);

    return { items, total };
  }

  async findCampaignById(params: { campaignId: string; tenantId: string; departmentId: string }) {
    return this.prismaClient.coordinatorAdvisorNotificationCampaign.findFirst({
      where: {
        id: params.campaignId,
        tenantId: params.tenantId,
        departmentId: params.departmentId,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        recipients: {
          orderBy: [{ fullName: 'asc' }],
          include: {
            inAppNotification: {
              select: {
                readAt: true,
              },
            },
          },
        },
      },
    });
  }

  async summarizeCampaigns(params: { tenantId: string; departmentId: string }) {
    const [totals, campaignCount, deliveredCampaignCount] = await Promise.all([
      this.prismaClient.coordinatorAdvisorNotificationCampaign.aggregate({
        where: {
          tenantId: params.tenantId,
          departmentId: params.departmentId,
        },
        _sum: {
          totalReachedCount: true,
          inAppDeliveredCount: true,
          emailQueuedCount: true,
          emailAcceptedCount: true,
          emailDeliveredCount: true,
          emailFailedCount: true,
        },
      }),
      this.prismaClient.coordinatorAdvisorNotificationCampaign.count({
        where: {
          tenantId: params.tenantId,
          departmentId: params.departmentId,
        },
      }),
      this.prismaClient.coordinatorAdvisorNotificationCampaign.count({
        where: {
          tenantId: params.tenantId,
          departmentId: params.departmentId,
          OR: [
            { inAppDeliveredCount: { gt: 0 } },
            { emailAcceptedCount: { gt: 0 } },
            { emailDeliveredCount: { gt: 0 } },
          ],
        },
      }),
    ]);

    return {
      totalSent: campaignCount,
      delivered: deliveredCampaignCount,
      totalReached: totals._sum.totalReachedCount ?? 0,
      inAppDelivered: totals._sum.inAppDeliveredCount ?? 0,
      emailQueued: totals._sum.emailQueuedCount ?? 0,
      emailAccepted: totals._sum.emailAcceptedCount ?? 0,
      emailDelivered: totals._sum.emailDeliveredCount ?? 0,
      emailFailed: totals._sum.emailFailedCount ?? 0,
    };
  }
}