import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GroupLeaderRequestStatus, NotificationEventType, NotificationSeverity } from '@prisma/client';

import { ROLES } from '../../common/constants/roles.constants';
import { NOTIFICATION_EVENT_TYPES } from '../../common/constants/notifications.constants';
import { InsufficientPermissionsException, UnauthorizedAccessException } from '../../common/exceptions';
import { EmailService } from '../../core/email/email.service';
import { QueueService } from '../../core/queue/queue.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthRepository } from '../auth/auth.repository';
import { NotificationService } from '../notification/notification.service';

import { GroupLeaderRequestRepository } from './group-leader-request.repository';
import { ApplyGroupLeaderRequestDto } from './dto/apply-group-leader-request.dto';
import { ListPendingGroupLeaderRequestsQueryDto } from './dto/list-pending-group-leader-requests.query.dto';
import { RejectGroupLeaderRequestDto } from './dto/reject-group-leader-request.dto';

@Injectable()
export class GroupLeaderRequestService {
  private readonly logger = new Logger(GroupLeaderRequestService.name);

  constructor(
    private readonly authRepository: AuthRepository,
    private readonly groupLeaderRequestRepository: GroupLeaderRequestRepository,
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly queueService: QueueService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService
  ) {}

  private async notifyBestEffort(data: {
    tenantId: string;
    userId: string;
    eventType: NotificationEventType;
    severity: NotificationSeverity;
    title: string;
    message: string;
    idempotencyKey: string;
    metadata?: any;
  }) {
    try {
      await this.notificationService.createNotification(data);
    } catch {
      // Best-effort: never break the main flow if notifications fail.
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
      this.logger.warn(`GroupLeaderRequestEmail: template send/enqueue failed (${message})`);
      try {
        await this.emailService.sendTransactionalTemplateEmail(params);
      } catch {
        // Best-effort: never break the main flow if emails fail.
      }
    }
  }

  private async requireDbUser(user: any) {
    if (!user?.sub) {
      throw new UnauthorizedAccessException();
    }

    const dbUser = await this.authRepository.findUserById(user.sub);
    if (!dbUser) {
      throw new UnauthorizedAccessException();
    }

    if (user.tenantId && user.tenantId !== 'system' && dbUser.tenantId !== user.tenantId) {
      throw new UnauthorizedAccessException();
    }

    return dbUser;
  }

  async apply(user: any, dto: ApplyGroupLeaderRequestDto) {
    const dbUser = await this.requireDbUser(user);

    const roles: string[] = user?.roles ?? [];
    if (!roles.includes(ROLES.STUDENT)) {
      throw new InsufficientPermissionsException('Only students can apply');
    }

    if (!dbUser.departmentId) {
      throw new BadRequestException('Student is not assigned to a department');
    }

    const existing = await this.groupLeaderRequestRepository.findByStudentUserId(dbUser.id);
    if (existing) {
      throw new BadRequestException('Student has already applied');
    }

    const applicationMessageText = dto.message ?? dto.reason;

    const created = await this.groupLeaderRequestRepository.createRequest({
      tenantId: dbUser.tenantId,
      departmentId: dbUser.departmentId,
      studentUserId: dbUser.id,
      message: applicationMessageText,
    });

    const department = await this.prisma.department.findUnique({
      where: { id: dbUser.departmentId },
      select: {
        id: true,
        name: true,
        headOfDepartmentId: true,
      },
    });

    if (department?.headOfDepartmentId) {
      await this.notifyBestEffort({
        tenantId: dbUser.tenantId,
        userId: department.headOfDepartmentId,
        eventType: NOTIFICATION_EVENT_TYPES.GROUP_LEADER_REQUEST_SUBMITTED as NotificationEventType,
        severity: NotificationSeverity.INFO,
        title: 'New group leader application',
        message: `${dbUser.firstName} ${dbUser.lastName} applied to become a group leader${department.name ? ` (${department.name})` : ''}.`,
        idempotencyKey: `group-leader-request:submitted:${created.id}`,
        metadata: {
          requestId: created.id,
          departmentId: dbUser.departmentId,
          studentUserId: dbUser.id,
        },
      });

      const templateId = this.configService.get<number>('email.groupLeaderRequestSubmittedTemplateId');
      if (templateId) {
        const deptHead = await this.prisma.user.findUnique({
          where: { id: department.headOfDepartmentId },
          select: { email: true, firstName: true, lastName: true },
        });

        if (deptHead?.email) {
          const studentName = `${dbUser.firstName ?? ''} ${dbUser.lastName ?? ''}`.trim();
          const deptHeadName = `${deptHead.firstName ?? ''} ${deptHead.lastName ?? ''}`.trim();
          const frontendUrl = this.configService.get<string>('app.frontendUrl');

          await this.sendTransactionalTemplateEmailBestEffort({
            to: { email: deptHead.email, name: deptHeadName || undefined },
            templateId,
            params: {
              ...this.emailService.getCommonTemplateParams(),
              recipientName: deptHeadName || undefined,
              frontendUrl,
              requestId: created.id,
              departmentName: department.name ?? undefined,
              studentName: studentName || undefined,
              studentEmail: dbUser.email,
              applicationMessage: applicationMessageText,
              submittedAt: created.createdAt,
            },
          });
        }
      }
    }

    const { applicationMessage, ...rest } = created;
    return {
      ...rest,
      message: applicationMessage ?? null,
    };
  }

  async getMyStatus(user: any) {
    const dbUser = await this.requireDbUser(user);

    const roles: string[] = user?.roles ?? [];
    if (!roles.includes(ROLES.STUDENT)) {
      throw new InsufficientPermissionsException('Only students can view their request status');
    }

    const req = await this.groupLeaderRequestRepository.findByStudentUserId(dbUser.id);
    if (!req) {
      return { status: null };
    }

    return {
      status: req.status,
      message: req.applicationMessage ?? null,
      reviewedAt: req.reviewedAt ?? null,
      rejectionReason: req.rejectionReason ?? null,
      createdAt: req.createdAt,
    };
  }

  async listPending(user: any, query: ListPendingGroupLeaderRequestsQueryDto) {
    const dbUser = await this.requireDbUser(user);

    const roles: string[] = user?.roles ?? [];
    if (!roles.includes(ROLES.DEPARTMENT_HEAD)) {
      throw new InsufficientPermissionsException('Only department heads can list pending requests');
    }

    if (!dbUser.departmentId) {
      throw new BadRequestException('User is not assigned to a department');
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const { items, total } = await this.groupLeaderRequestRepository.listPendingByDepartmentPaged({
      tenantId: dbUser.tenantId,
      departmentId: dbUser.departmentId,
      skip,
      take: limit,
      search: query.search,
    });

    return {
      items: items.map((r) => ({
        id: r.id,
        status: r.status,
        createdAt: r.createdAt,
        message: r.applicationMessage ?? null,
        student: {
          id: r.studentUser.id,
          firstName: r.studentUser.firstName,
          lastName: r.studentUser.lastName,
          email: r.studentUser.email,
          avatarUrl: r.studentUser.avatarUrl,
          tenantId: r.studentUser.tenantId,
          departmentId: r.studentUser.departmentId,
          profile: {
            bio: r.studentUser.student?.bio ?? null,
            githubUrl: r.studentUser.student?.githubUrl ?? null,
            linkedinUrl: r.studentUser.student?.linkedinUrl ?? null,
            portfolioUrl: r.studentUser.student?.portfolioUrl ?? null,
            techStack: (r.studentUser.student?.techStack as string[] | null) ?? [],
            updatedAt: r.studentUser.student?.updatedAt ?? null,
          },
        },
      })),
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  private ensureDeptHeadRole(user: any) {
    const roles: string[] = user?.roles ?? [];
    if (!roles.includes(ROLES.DEPARTMENT_HEAD)) {
      throw new InsufficientPermissionsException('Only department heads can review requests');
    }
  }

  async approve(user: any, requestId: string) {
    const dbUser = await this.requireDbUser(user);
    this.ensureDeptHeadRole(user);

    if (!dbUser.departmentId) {
      throw new BadRequestException('User is not assigned to a department');
    }

    const existing = await this.groupLeaderRequestRepository.findById(requestId);
    if (!existing) {
      throw new NotFoundException('Request not found');
    }
    if (existing.tenantId !== dbUser.tenantId || existing.departmentId !== dbUser.departmentId) {
      throw new InsufficientPermissionsException('Request is not accessible');
    }
    if (existing.status !== GroupLeaderRequestStatus.PENDING) {
      throw new BadRequestException('Only pending requests can be approved');
    }

    const updated = await this.groupLeaderRequestRepository.approveRequest({
      id: requestId,
      reviewerUserId: dbUser.id,
    });

    await this.notifyBestEffort({
      tenantId: dbUser.tenantId,
      userId: updated.studentUserId,
      eventType: NOTIFICATION_EVENT_TYPES.GROUP_LEADER_REQUEST_APPROVED as NotificationEventType,
      severity: NotificationSeverity.INFO,
      title: 'Group leader request approved',
      message: 'Your group leader request has been approved.',
      idempotencyKey: `group-leader-request:approved:${updated.id}`,
      metadata: { requestId: updated.id },
    });

    const templateId = this.configService.get<number>('email.groupLeaderRequestApprovedTemplateId');
    if (templateId) {
      const student = await this.prisma.user.findUnique({
        where: { id: updated.studentUserId },
        select: { email: true, firstName: true, lastName: true },
      });

      if (student?.email) {
        const studentName = `${student.firstName ?? ''} ${student.lastName ?? ''}`.trim();
        const frontendUrl = this.configService.get<string>('app.frontendUrl');

        await this.sendTransactionalTemplateEmailBestEffort({
          to: { email: student.email, name: studentName || undefined },
          templateId,
          params: {
            ...this.emailService.getCommonTemplateParams(),
            recipientName: studentName || undefined,
            frontendUrl,
            requestId: updated.id,
            status: updated.status,
            reviewedAt: updated.reviewedAt ?? null,
          },
        });
      }
    }

    return updated;
  }

  async reject(user: any, requestId: string, dto: RejectGroupLeaderRequestDto) {
    const dbUser = await this.requireDbUser(user);
    this.ensureDeptHeadRole(user);

    if (!dbUser.departmentId) {
      throw new BadRequestException('User is not assigned to a department');
    }

    const existing = await this.groupLeaderRequestRepository.findById(requestId);
    if (!existing) {
      throw new NotFoundException('Request not found');
    }
    if (existing.tenantId !== dbUser.tenantId || existing.departmentId !== dbUser.departmentId) {
      throw new InsufficientPermissionsException('Request is not accessible');
    }
    if (existing.status !== GroupLeaderRequestStatus.PENDING) {
      throw new BadRequestException('Only pending requests can be rejected');
    }

    const updated = await this.groupLeaderRequestRepository.rejectRequest({
      id: requestId,
      reviewerUserId: dbUser.id,
      reason: dto.reason,
    });

    await this.notifyBestEffort({
      tenantId: dbUser.tenantId,
      userId: updated.studentUserId,
      eventType: NOTIFICATION_EVENT_TYPES.GROUP_LEADER_REQUEST_REJECTED as NotificationEventType,
      severity: NotificationSeverity.INFO,
      title: 'Group leader request rejected',
      message: updated.rejectionReason
        ? `Your group leader request was rejected: ${updated.rejectionReason}`
        : 'Your group leader request was rejected.',
      idempotencyKey: `group-leader-request:rejected:${updated.id}`,
      metadata: { requestId: updated.id },
    });

    const templateId = this.configService.get<number>('email.groupLeaderRequestRejectedTemplateId');
    if (templateId) {
      const student = await this.prisma.user.findUnique({
        where: { id: updated.studentUserId },
        select: { email: true, firstName: true, lastName: true },
      });

      if (student?.email) {
        const studentName = `${student.firstName ?? ''} ${student.lastName ?? ''}`.trim();
        const frontendUrl = this.configService.get<string>('app.frontendUrl');

        await this.sendTransactionalTemplateEmailBestEffort({
          to: { email: student.email, name: studentName || undefined },
          templateId,
          params: {
            ...this.emailService.getCommonTemplateParams(),
            recipientName: studentName || undefined,
            frontendUrl,
            requestId: updated.id,
            status: updated.status,
            reviewedAt: updated.reviewedAt ?? null,
            rejectionReason: updated.rejectionReason ?? undefined,
          },
        });
      }
    }

    return updated;
  }
}
