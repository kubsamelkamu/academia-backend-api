import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { TenantRepository } from './tenant.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { ROLES } from '../../common/constants/roles.constants';
import {
  InsufficientPermissionsException,
  UnauthorizedAccessException,
} from '../../common/exceptions';
import { InvitationsService } from '../invitations/invitations.service';
import { CloudinaryService } from '../../core/storage/cloudinary.service';
import { QueueService } from '../../core/queue/queue.service';
import { EmailService } from '../../core/email/email.service';
import { ConfigService } from '@nestjs/config';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class TenantService {
  private readonly logger = new Logger(TenantService.name);

  constructor(
    private readonly tenantRepository: TenantRepository,
    private readonly prisma: PrismaService,
    private readonly invitations: InvitationsService,
    private readonly cloudinaryService: CloudinaryService,
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

      // In local dev, direct-send makes iteration easier.
      if (isDev) {
        await this.emailService.sendTransactionalEmail(params);
        return;
      }

      // In prod without worker, still enqueue (QueueModule may be active).
      await this.queueService.addTransactionalEmailJob(params);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `VerificationEmail: failed enqueue/send (${message}); attempting direct-send`
      );
      try {
        await this.emailService.sendTransactionalEmail(params);
      } catch {
        // Best-effort: do not block the submission on email failures.
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

  async getCurrentTenant(user: any) {
    if (!user?.tenantId) {
      throw new UnauthorizedAccessException();
    }

    const roles: string[] = user.roles ?? [];
    if (!roles.includes(ROLES.DEPARTMENT_HEAD) && !roles.includes(ROLES.PLATFORM_ADMIN)) {
      throw new InsufficientPermissionsException();
    }

    const tenant = await this.tenantRepository.findTenantById(user.tenantId);
    if (!tenant) {
      throw new UnauthorizedAccessException('Tenant not found');
    }

    return tenant;
  }

  async updateTenantConfig(user: any, config: any) {
    if (!user?.tenantId) {
      throw new UnauthorizedAccessException();
    }

    const roles: string[] = user.roles ?? [];
    if (!roles.includes(ROLES.DEPARTMENT_HEAD) && !roles.includes(ROLES.PLATFORM_ADMIN)) {
      throw new InsufficientPermissionsException();
    }

    return this.tenantRepository.updateTenantConfig(user.tenantId, config);
  }

  async getDepartments(user: any) {
    if (!user?.tenantId) {
      throw new UnauthorizedAccessException();
    }

    const roles: string[] = user.roles ?? [];
    if (!roles.includes(ROLES.DEPARTMENT_HEAD) && !roles.includes(ROLES.PLATFORM_ADMIN)) {
      throw new InsufficientPermissionsException();
    }

    return this.tenantRepository.findDepartmentsByTenant(user.tenantId);
  }

  async createDepartment(
    user: any,
    data: { name: string; code: string; description?: string; headOfDepartmentId?: string }
  ) {
    if (!user?.tenantId) {
      throw new UnauthorizedAccessException();
    }

    const roles: string[] = user.roles ?? [];
    if (!roles.includes(ROLES.DEPARTMENT_HEAD) && !roles.includes(ROLES.PLATFORM_ADMIN)) {
      throw new InsufficientPermissionsException();
    }

    // Validate headOfDepartmentId if provided
    if (data.headOfDepartmentId) {
      // TODO: Check if headOfDepartmentId belongs to this tenant and has appropriate role
    }

    return this.tenantRepository.createDepartment(user.tenantId, data);
  }

  async updateDepartment(
    user: any,
    departmentId: string,
    data: { name?: string; code?: string; description?: string; headOfDepartmentId?: string }
  ) {
    if (!user?.tenantId) {
      throw new UnauthorizedAccessException();
    }

    const roles: string[] = user.roles ?? [];
    if (!roles.includes(ROLES.DEPARTMENT_HEAD) && !roles.includes(ROLES.PLATFORM_ADMIN)) {
      throw new InsufficientPermissionsException();
    }

    // Validate headOfDepartmentId if provided
    if (data.headOfDepartmentId) {
      // TODO: Check if headOfDepartmentId belongs to this tenant and has appropriate role
    }

    return this.tenantRepository.updateDepartment(departmentId, user.tenantId, data);
  }

  async getAcademicYears(user: any) {
    if (!user?.tenantId) {
      throw new UnauthorizedAccessException();
    }

    const roles: string[] = user.roles ?? [];
    if (!roles.includes(ROLES.DEPARTMENT_HEAD) && !roles.includes(ROLES.PLATFORM_ADMIN)) {
      throw new InsufficientPermissionsException();
    }

    return this.tenantRepository.findAcademicYearsByTenant(user.tenantId);
  }

  async createAcademicYear(
    user: any,
    data: { name: string; startDate: Date; endDate: Date; description?: string; config?: any }
  ) {
    if (!user?.tenantId) {
      throw new UnauthorizedAccessException();
    }

    const roles: string[] = user.roles ?? [];
    if (!roles.includes(ROLES.DEPARTMENT_HEAD) && !roles.includes(ROLES.PLATFORM_ADMIN)) {
      throw new InsufficientPermissionsException();
    }

    // Validate date range
    if (data.startDate >= data.endDate) {
      throw new BadRequestException('Start date must be before end date');
    }

    return this.tenantRepository.createAcademicYear(user.tenantId, data);
  }

  async updateAcademicYear(
    user: any,
    academicYearId: string,
    data: {
      name?: string;
      startDate?: Date;
      endDate?: Date;
      isActive?: boolean;
      description?: string;
      config?: any;
    }
  ) {
    if (!user?.tenantId) {
      throw new UnauthorizedAccessException();
    }

    const roles: string[] = user.roles ?? [];
    if (!roles.includes(ROLES.DEPARTMENT_HEAD) && !roles.includes(ROLES.PLATFORM_ADMIN)) {
      throw new InsufficientPermissionsException();
    }

    // Validate date range if both dates are provided
    if (data.startDate && data.endDate && data.startDate >= data.endDate) {
      throw new BadRequestException('Start date must be before end date');
    }

    return this.tenantRepository.updateAcademicYear(academicYearId, user.tenantId, data);
  }

  async getDepartmentUsers(user: any) {
    // Only department head can access users in their department
    if (!user.roles.includes(ROLES.DEPARTMENT_HEAD)) {
      throw new InsufficientPermissionsException();
    }

    // Get user's department
    const userRecord = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { departmentId: true },
    });

    if (!userRecord?.departmentId) {
      throw new BadRequestException('User is not assigned to a department');
    }

    return this.tenantRepository.getDepartmentUsers(userRecord.departmentId, user.tenantId);
  }

  async getUserById(user: any, userId: string) {
    // Only department head can access users in their department
    if (!user.roles.includes(ROLES.DEPARTMENT_HEAD)) {
      throw new InsufficientPermissionsException();
    }

    // Get user's department
    const userRecord = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { departmentId: true },
    });

    if (!userRecord?.departmentId) {
      throw new BadRequestException('User is not assigned to a department');
    }

    const userData = await this.tenantRepository.getUserById(
      userId,
      userRecord.departmentId,
      user.tenantId
    );
    if (!userData) {
      throw new NotFoundException('User not found in your department');
    }

    return userData;
  }

  async createUser(
    user: any,
    data: {
      email: string;
      firstName: string;
      lastName: string;
      password?: string;
      roleName: string;
    }
  ) {
    // Only department head can create users in their department
    if (!user.roles.includes(ROLES.DEPARTMENT_HEAD)) {
      throw new InsufficientPermissionsException();
    }

    // Get user's department
    const userRecord = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { departmentId: true },
    });

    if (!userRecord?.departmentId) {
      throw new BadRequestException('User is not assigned to a department');
    }

    // Validate role - department head can only create students, advisors, coordinators
    const allowedRoles = [ROLES.STUDENT, ROLES.ADVISOR, ROLES.COORDINATOR];
    if (!allowedRoles.includes(data.roleName as any)) {
      throw new BadRequestException(
        'Department head can only create students, advisors, or coordinators'
      );
    }

    // Check if email already exists in tenant
    const existingUser = await this.prisma.user.findUnique({
      where: {
        tenantId_email: {
          tenantId: user.tenantId,
          email: data.email,
        },
      },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const createdUser = await this.tenantRepository.createUser(
      data,
      userRecord.departmentId,
      user.tenantId,
      user.sub
    );

    return createdUser;
  }

  async createInvitation(
    user: any,
    data: {
      email: string;
      roleName: string;
    }
  ) {
    if (!user?.tenantId) {
      throw new UnauthorizedAccessException();
    }

    if (!user.roles?.includes(ROLES.DEPARTMENT_HEAD)) {
      throw new InsufficientPermissionsException();
    }

    const inviter = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { id: true, departmentId: true },
    });

    if (!inviter?.departmentId) {
      throw new BadRequestException('Inviter is not assigned to a department');
    }

    const allowedRoles = [ROLES.STUDENT, ROLES.ADVISOR, ROLES.COORDINATOR];
    if (!allowedRoles.includes(data.roleName as any)) {
      throw new BadRequestException(
        'Department head can only invite students, advisors, or coordinators'
      );
    }

    const email = data.email.toLowerCase();

    const existingUser = await this.prisma.user.findUnique({
      where: {
        tenantId_email: {
          tenantId: user.tenantId,
          email,
        },
      },
      select: { id: true },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const invitation = await this.invitations.createInvitation({
      tenantId: user.tenantId,
      departmentId: inviter.departmentId,
      email,
      roleName: data.roleName,
      invitedByAdminId: inviter.id,
    });

    return {
      id: invitation.id,
      tenantId: invitation.tenantId,
      departmentId: invitation.departmentId,
      email: invitation.email,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
    };
  }

  async updateUser(
    user: any,
    userId: string,
    data: {
      firstName?: string;
      lastName?: string;
      email?: string;
    }
  ) {
    // Only department head can update users in their department
    if (!user.roles.includes(ROLES.DEPARTMENT_HEAD)) {
      throw new InsufficientPermissionsException();
    }

    // Get user's department
    const userRecord = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { departmentId: true },
    });

    if (!userRecord?.departmentId) {
      throw new BadRequestException('User is not assigned to a department');
    }

    // Check if email is being updated and if it's unique
    if (data.email) {
      const existingUser = await this.prisma.user.findFirst({
        where: {
          tenantId: user.tenantId,
          email: data.email,
          id: { not: userId },
        },
      });

      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }
    }

    return this.tenantRepository.updateUser(userId, data, userRecord.departmentId, user.tenantId);
  }

  async deactivateUser(user: any, userId: string) {
    // Only department head can deactivate users in their department
    if (!user.roles.includes(ROLES.DEPARTMENT_HEAD)) {
      throw new InsufficientPermissionsException();
    }

    // Get user's department
    const userRecord = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { departmentId: true },
    });

    if (!userRecord?.departmentId) {
      throw new BadRequestException('User is not assigned to a department');
    }

    // Cannot deactivate themselves
    if (userId === user.sub) {
      throw new BadRequestException('Cannot deactivate your own account');
    }

    return this.tenantRepository.deactivateUser(userId, userRecord.departmentId, user.tenantId);
  }

  async submitVerificationDocument(user: any, file: Express.Multer.File) {
    if (!user?.sub || !user?.tenantId) {
      throw new UnauthorizedAccessException();
    }

    if (!user.roles?.includes(ROLES.DEPARTMENT_HEAD)) {
      throw new InsufficientPermissionsException();
    }

    if (!file?.buffer || !file.mimetype) {
      throw new BadRequestException('Document file is required');
    }

    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: {
        id: true,
        tenantId: true,
        email: true,
        firstName: true,
        lastName: true,
        emailVerified: true,
      },
    });

    if (!dbUser || dbUser.tenantId !== user.tenantId) {
      throw new UnauthorizedAccessException();
    }

    if (!dbUser.emailVerified) {
      throw new BadRequestException('Please verify your email before submitting verification');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { id: true, name: true, domain: true },
    });

    const uploaded = await this.cloudinaryService.uploadTenantVerificationDocument({
      tenantId: user.tenantId,
      userId: user.sub,
      buffer: file.buffer,
      mimeType: file.mimetype,
      fileName: file.originalname,
    });

    try {
      const request = await this.prisma.tenantVerificationRequest.create({
        data: {
          tenantId: user.tenantId,
          submittedByUserId: user.sub,
          status: 'PENDING',
          documentUrl: uploaded.secureUrl,
          documentPublicId: uploaded.publicId,
          fileName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: typeof file.size === 'number' ? file.size : undefined,
        },
        select: {
          id: true,
          tenantId: true,
          submittedByUserId: true,
          status: true,
          documentUrl: true,
          fileName: true,
          mimeType: true,
          sizeBytes: true,
          createdAt: true,
        },
      });

      const supportEmail =
        this.configService.get<string>('email.supportEmail') || 'support@academia.et';

      const deptHeadName = `${dbUser.firstName} ${dbUser.lastName}`.trim();
      const tenantName = tenant?.name ?? 'Institution';
      const tenantDomain = tenant?.domain ?? undefined;

      const submissionDetailsHtml = `<p><b>Institution:</b> ${tenantName}${tenantDomain ? ` (<code>${tenantDomain}</code>)` : ''}</p>
<p><b>Submitted by:</b> ${deptHeadName} (${dbUser.email})</p>
<p><b>File:</b> ${file.originalname} (${file.mimetype}, ${Math.round((file.size ?? 0) / 1024)} KB)</p>
<p><b>Request ID:</b> ${request.id}</p>`;

      const submittedAdminTemplateId = this.configService.get<number>(
        'email.institutionVerificationSubmittedAdminTemplateId'
      );
      if (submittedAdminTemplateId) {
        await this.sendTransactionalTemplateEmailBestEffort({
          to: { email: supportEmail, name: 'Support Team' },
          templateId: submittedAdminTemplateId,
          params: {
            ...this.getCommonTemplateParamsSafe(),
            tenantName,
            tenantDomain,
            submittedByName: deptHeadName,
            submittedByEmail: dbUser.email,
            requestId: request.id,
            submittedAt: request.createdAt.toISOString(),
            fileName: file.originalname,
            mimeType: file.mimetype,
            sizeKb: Math.round((file.size ?? 0) / 1024),
            documentUrl: request.documentUrl,
          },
        });
      } else {
        await this.sendTransactionalEmailBestEffort({
          to: { email: supportEmail, name: 'Support Team' },
          subject: `New Institution Verification Submission - ${tenantName}`,
          htmlContent: `<p>Hello Platform Admin,</p>
<p>A new institution verification document has been submitted and requires review.</p>
${submissionDetailsHtml}
<p>Document URL: <a href="${request.documentUrl}">${request.documentUrl}</a></p>`,
          textContent: `New institution verification submission. Institution: ${tenantName}${tenantDomain ? ` (${tenantDomain})` : ''}. Submitted by: ${deptHeadName} (${dbUser.email}). File: ${file.originalname} (${file.mimetype}). Request ID: ${request.id}. Document URL: ${request.documentUrl}`,
        });
      }

      const receivedDeptHeadTemplateId = this.configService.get<number>(
        'email.institutionVerificationReceivedDeptHeadTemplateId'
      );
      if (receivedDeptHeadTemplateId) {
        await this.sendTransactionalTemplateEmailBestEffort({
          to: { email: dbUser.email, name: deptHeadName || undefined },
          templateId: receivedDeptHeadTemplateId,
          params: {
            ...this.getCommonTemplateParamsSafe(),
            recipientName: deptHeadName || dbUser.email,
            tenantName,
            requestId: request.id,
            submittedAt: request.createdAt.toISOString(),
          },
        });
      } else {
        await this.sendTransactionalEmailBestEffort({
          to: { email: dbUser.email, name: deptHeadName || undefined },
          subject: `Verification document received - ${tenantName}`,
          htmlContent: `<p>Hello ${deptHeadName || 'there'},</p>
<p>We received your institution verification document and it is now <b>pending review</b>.</p>
<p><b>Institution:</b> ${tenantName}${tenantDomain ? ` (<code>${tenantDomain}</code>)` : ''}</p>
<p><b>Request ID:</b> ${request.id}</p>
<p>You can continue using the platform while review is pending.</p>`,
          textContent: `We received your institution verification document for ${tenantName}${tenantDomain ? ` (${tenantDomain})` : ''}. Status: PENDING. Request ID: ${request.id}. You can continue using the platform while review is pending.`,
        });
      }

      // Best-effort in-app notification (do not block submission).
      try {
        await this.notificationService.notifyInstitutionVerificationSubmitted({
          tenantId: request.tenantId,
          userId: request.submittedByUserId,
          requestId: request.id,
          tenantName,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`VerificationNotification: submit failed (${message})`);
      }

      // Best-effort in-app notification to Platform Admins (system tenant).
      try {
        await this.notificationService.notifyPlatformAdminsInstitutionVerificationSubmitted({
          requestId: request.id,
          tenantId: request.tenantId,
          tenantName,
          tenantDomain,
          submittedByEmail: dbUser.email,
          submittedByName: deptHeadName || undefined,
          documentUrl: request.documentUrl,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`VerificationNotification: admin notify failed (${message})`);
      }

      return request;
    } catch (err) {
      // Cleanup uploaded file if DB write fails.
      try {
        await this.cloudinaryService.deleteByPublicId(uploaded.publicId, uploaded.resourceType);
      } catch {
        // ignore cleanup failure
      }
      throw err;
    }
  }
}
