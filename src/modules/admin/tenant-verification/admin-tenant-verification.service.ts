import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { ROLES } from '../../../common/constants/roles.constants';
import { TenantVerificationStatus } from '@prisma/client';
import {
  InsufficientPermissionsException,
  UnauthorizedAccessException,
} from '../../../common/exceptions';
import { QueueService } from '../../../core/queue/queue.service';
import { EmailService } from '../../../core/email/email.service';
import { NotificationService } from '../../notification/notification.service';

@Injectable()
export class AdminTenantVerificationService {
  private static readonly DEFAULT_LIMIT = 10;
  private readonly logger = new Logger(AdminTenantVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly emailService: EmailService,
    private readonly notificationService: NotificationService,
    private readonly configService: ConfigService
  ) {}

  private async sendTransactionalEmailBestEffort(params: {
    to: { email: string; name?: string };
    subject: string;
    htmlContent: string;
    textContent?: string;
  }): Promise<void> {
    const workerEnabled = (process.env.WORKER ?? '').toLowerCase() === 'true';
    const isDev = (process.env.NODE_ENV ?? 'development').toLowerCase() !== 'production';

    try {
      if (workerEnabled) {
        await this.queueService.addTransactionalEmailJob(params);
        return;
      }

      if (isDev) {
        await this.emailService.sendTransactionalEmail(params);
        return;
      }

      await this.queueService.addTransactionalEmailJob(params);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `VerificationEmail: failed enqueue/send (${message}); attempting direct-send`
      );
      try {
        await this.emailService.sendTransactionalEmail(params);
      } catch {
        // Best-effort.
      }
    }
  }

  private async sendTransactionalTemplateEmailBestEffort(params: {
    to: { email: string; name?: string };
    templateId: number;
    params?: Record<string, unknown>;
  }): Promise<void> {
    const workerEnabled = (process.env.WORKER ?? '').toLowerCase() === 'true';
    const isDev = (process.env.NODE_ENV ?? 'development').toLowerCase() !== 'production';

    try {
      if (workerEnabled) {
        await this.queueService.addTransactionalTemplateEmailJob(params);
        return;
      }

      if (isDev) {
        await this.emailService.sendTransactionalTemplateEmail(params);
        return;
      }

      await this.queueService.addTransactionalTemplateEmailJob(params);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `VerificationEmail: template failed enqueue/send (${message}); attempting direct-send`
      );
      try {
        await this.emailService.sendTransactionalTemplateEmail(params);
      } catch {
        // Best-effort.
      }
    }
  }

  private getCommonTemplateParamsSafe(): Record<string, unknown> {
    const emailService = this.emailService as unknown as {
      getCommonTemplateParams?: () => Record<string, unknown>;
    };

    if (typeof emailService.getCommonTemplateParams === 'function') {
      return emailService.getCommonTemplateParams();
    }

    return {};
  }

  private assertPlatformAdmin(user: any) {
    if (!user?.sub) {
      throw new UnauthorizedAccessException();
    }

    const roles: string[] = user.roles ?? [];
    if (!roles.includes(ROLES.PLATFORM_ADMIN)) {
      throw new InsufficientPermissionsException();
    }

    return { userId: String(user.sub) };
  }

  async listRequests(params: {
    user: any;
    page?: number;
    limit?: number;
    status?: TenantVerificationStatus;
    tenantId?: string;
  }) {
    const { userId } = this.assertPlatformAdmin(params.user);

    const page = params.page ?? 1;
    const limit = params.limit ?? AdminTenantVerificationService.DEFAULT_LIMIT;
    const skip = (page - 1) * limit;

    const status = params.status ?? TenantVerificationStatus.PENDING;

    this.logger.log(
      `List verification requests (adminUserId=${userId}, status=${status}, page=${page}, limit=${limit})`
    );

    const where = {
      status,
      ...(params.tenantId ? { tenantId: params.tenantId } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.tenantVerificationRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          tenantId: true,
          status: true,
          createdAt: true,
          reviewedAt: true,
          reviewReason: true,
          fileName: true,
          mimeType: true,
          sizeBytes: true,
          tenant: {
            select: { id: true, name: true, domain: true, status: true },
          },
          submittedBy: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      }),
      this.prisma.tenantVerificationRequest.count({ where }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async getRequestById(user: any, requestId: string) {
    const { userId } = this.assertPlatformAdmin(user);
    this.logger.log(`Get verification request (adminUserId=${userId}, requestId=${requestId})`);

    const request = await this.prisma.tenantVerificationRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        tenantId: true,
        submittedByUserId: true,
        status: true,
        documentUrl: true,
        documentPublicId: true,
        fileName: true,
        mimeType: true,
        sizeBytes: true,
        reviewedByUserId: true,
        reviewedAt: true,
        reviewReason: true,
        createdAt: true,
        updatedAt: true,
        tenant: {
          select: { id: true, name: true, domain: true, status: true },
        },
        submittedBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        reviewedBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });

    if (!request) {
      throw new NotFoundException('Verification request not found');
    }

    return request;
  }

  async approveRequest(user: any, requestId: string, reason?: string) {
    const { userId } = this.assertPlatformAdmin(user);
    this.logger.log(`Approve verification request (adminUserId=${userId}, requestId=${requestId})`);

    const result = await this.prisma.tenantVerificationRequest.updateMany({
      where: { id: requestId, status: TenantVerificationStatus.PENDING },
      data: {
        status: TenantVerificationStatus.APPROVED,
        reviewedByUserId: userId,
        reviewedAt: new Date(),
        reviewReason: reason?.trim() || null,
      },
    });

    if (result.count === 0) {
      const existing = await this.prisma.tenantVerificationRequest.findUnique({
        where: { id: requestId },
        select: { id: true, status: true },
      });

      if (!existing) {
        throw new NotFoundException('Verification request not found');
      }

      throw new ConflictException(`Verification request already ${existing.status.toLowerCase()}`);
    }

    const request = await this.getRequestById(user, requestId);

    const supportEmail =
      this.configService.get<string>('email.supportEmail') || 'support@academia.et';
    const tenantName = request.tenant?.name ?? 'Institution';
    const tenantDomain = request.tenant?.domain ?? undefined;
    const deptHeadName =
      `${request.submittedBy?.firstName ?? ''} ${request.submittedBy?.lastName ?? ''}`.trim();
    const deptHeadEmail = request.submittedBy?.email;

    if (deptHeadEmail) {
      const approvedTemplateId = this.configService.get<number>(
        'email.institutionVerificationApprovedTemplateId'
      );
      if (approvedTemplateId) {
        await this.sendTransactionalTemplateEmailBestEffort({
          to: { email: deptHeadEmail, name: deptHeadName || undefined },
          templateId: approvedTemplateId,
          params: {
            ...this.getCommonTemplateParamsSafe(),
            recipientName: deptHeadName || deptHeadEmail,
            tenantName,
            requestId: request.id,
            reviewedAt: request.reviewedAt
              ? request.reviewedAt.toISOString()
              : new Date().toISOString(),
            reason: request.reviewReason ?? undefined,
          },
        });
      } else {
        await this.sendTransactionalEmailBestEffort({
          to: { email: deptHeadEmail, name: deptHeadName || undefined },
          subject: `Verification approved - ${tenantName}`,
          htmlContent: `<p>Hello ${deptHeadName || 'there'},</p>
<p>Your institution verification has been <b>approved</b>.</p>
<p><b>Institution:</b> ${tenantName}${tenantDomain ? ` (<code>${tenantDomain}</code>)` : ''}</p>
<p><b>Request ID:</b> ${request.id}</p>
${request.reviewReason ? `<p><b>Note:</b> ${request.reviewReason}</p>` : ''}`,
          textContent: `Your institution verification has been approved. Institution: ${tenantName}${tenantDomain ? ` (${tenantDomain})` : ''}. Request ID: ${request.id}.${request.reviewReason ? ` Note: ${request.reviewReason}` : ''}`,
        });
      }
    }

    // Optional audit email to support mailbox (best-effort).
    await this.sendTransactionalEmailBestEffort({
      to: { email: supportEmail, name: 'Support Team' },
      subject: `Verification approved - ${tenantName}`,
      htmlContent: `<p>Hello Platform Admin,</p>
<p>A verification request was <b>approved</b>.</p>
<p><b>Institution:</b> ${tenantName}${tenantDomain ? ` (<code>${tenantDomain}</code>)` : ''}</p>
<p><b>Request ID:</b> ${request.id}</p>
<p><b>Reviewed by:</b> ${userId}</p>
${request.reviewReason ? `<p><b>Reason/Note:</b> ${request.reviewReason}</p>` : ''}`,
      textContent: `Verification approved. Institution: ${tenantName}${tenantDomain ? ` (${tenantDomain})` : ''}. Request ID: ${request.id}. Reviewed by: ${userId}.${request.reviewReason ? ` Note: ${request.reviewReason}` : ''}`,
    });

    // Best-effort in-app notification.
    try {
      await this.notificationService.notifyInstitutionVerificationApproved({
        tenantId: request.tenantId,
        userId: request.submittedByUserId,
        requestId: request.id,
        tenantName,
        reason: request.reviewReason,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`VerificationNotification: approve failed (${message})`);
    }

    return request;
  }

  async rejectRequest(user: any, requestId: string, reason: string) {
    const { userId } = this.assertPlatformAdmin(user);
    this.logger.log(`Reject verification request (adminUserId=${userId}, requestId=${requestId})`);

    const normalizedReason = reason.trim();

    const result = await this.prisma.tenantVerificationRequest.updateMany({
      where: { id: requestId, status: TenantVerificationStatus.PENDING },
      data: {
        status: TenantVerificationStatus.REJECTED,
        reviewedByUserId: userId,
        reviewedAt: new Date(),
        reviewReason: normalizedReason,
      },
    });

    if (result.count === 0) {
      const existing = await this.prisma.tenantVerificationRequest.findUnique({
        where: { id: requestId },
        select: { id: true, status: true },
      });

      if (!existing) {
        throw new NotFoundException('Verification request not found');
      }

      throw new ConflictException(`Verification request already ${existing.status.toLowerCase()}`);
    }

    const request = await this.getRequestById(user, requestId);

    const supportEmail =
      this.configService.get<string>('email.supportEmail') || 'support@academia.et';
    const tenantName = request.tenant?.name ?? 'Institution';
    const tenantDomain = request.tenant?.domain ?? undefined;
    const deptHeadName =
      `${request.submittedBy?.firstName ?? ''} ${request.submittedBy?.lastName ?? ''}`.trim();
    const deptHeadEmail = request.submittedBy?.email;

    if (deptHeadEmail) {
      const rejectedTemplateId = this.configService.get<number>(
        'email.institutionVerificationRejectedTemplateId'
      );
      if (rejectedTemplateId) {
        await this.sendTransactionalTemplateEmailBestEffort({
          to: { email: deptHeadEmail, name: deptHeadName || undefined },
          templateId: rejectedTemplateId,
          params: {
            ...this.getCommonTemplateParamsSafe(),
            recipientName: deptHeadName || deptHeadEmail,
            tenantName,
            requestId: request.id,
            reviewedAt: request.reviewedAt
              ? request.reviewedAt.toISOString()
              : new Date().toISOString(),
            reason: request.reviewReason,
          },
        });
      } else {
        await this.sendTransactionalEmailBestEffort({
          to: { email: deptHeadEmail, name: deptHeadName || undefined },
          subject: `Verification rejected - ${tenantName}`,
          htmlContent: `<p>Hello ${deptHeadName || 'there'},</p>
<p>Your institution verification was <b>rejected</b>.</p>
<p><b>Institution:</b> ${tenantName}${tenantDomain ? ` (<code>${tenantDomain}</code>)` : ''}</p>
<p><b>Request ID:</b> ${request.id}</p>
<p><b>Reason:</b> ${request.reviewReason}</p>
<p>Please review the reason and resubmit your document.</p>`,
          textContent: `Your institution verification was rejected. Institution: ${tenantName}${tenantDomain ? ` (${tenantDomain})` : ''}. Request ID: ${request.id}. Reason: ${request.reviewReason}. Please review the reason and resubmit your document.`,
        });
      }
    }

    // Optional audit email to support mailbox (best-effort).
    await this.sendTransactionalEmailBestEffort({
      to: { email: supportEmail, name: 'Support Team' },
      subject: `Verification rejected - ${tenantName}`,
      htmlContent: `<p>Hello Platform Admin,</p>
<p>A verification request was <b>rejected</b>.</p>
<p><b>Institution:</b> ${tenantName}${tenantDomain ? ` (<code>${tenantDomain}</code>)` : ''}</p>
<p><b>Request ID:</b> ${request.id}</p>
<p><b>Reviewed by:</b> ${userId}</p>
<p><b>Reason:</b> ${request.reviewReason}</p>`,
      textContent: `Verification rejected. Institution: ${tenantName}${tenantDomain ? ` (${tenantDomain})` : ''}. Request ID: ${request.id}. Reviewed by: ${userId}. Reason: ${request.reviewReason}.`,
    });

    // Best-effort in-app notification.
    try {
      await this.notificationService.notifyInstitutionVerificationRejected({
        tenantId: request.tenantId,
        userId: request.submittedByUserId,
        requestId: request.id,
        tenantName,
        reason: request.reviewReason ?? normalizedReason,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`VerificationNotification: reject failed (${message})`);
    }

    return request;
  }
}
