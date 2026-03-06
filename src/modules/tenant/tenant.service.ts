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
import { buildInvitationEmailContent } from '../invitations/invitation-email-content';
import { CloudinaryService } from '../../core/storage/cloudinary.service';
import { QueueService } from '../../core/queue/queue.service';
import { EmailService } from '../../core/email/email.service';
import { ConfigService } from '@nestjs/config';
import { NotificationService } from '../notification/notification.service';
import {
  NOTIFICATION_EVENT_TYPES,
  NOTIFICATION_SEVERITIES,
} from '../../common/constants/notifications.constants';
import { NotificationEventType, NotificationSeverity } from '@prisma/client';
import { asTenantConfig } from '../../common/types/tenant-config.types';
import { UpdateTenantAddressDto } from './dto/update-tenant-address.dto';
import { randomBytes } from 'crypto';
import { ListFacultyQueryDto } from './dto/list-faculty.dto';
import { ListDepartmentUsersQueryDto } from './dto/list-department-users.dto';
import { ListInvitationsPagedQueryDto } from './dto/list-invitations.dto';

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

  async updateTenantAddress(user: any, dto: UpdateTenantAddressDto) {
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

    const existingConfig = asTenantConfig(tenant.config);
    const existingAddress = (existingConfig.address ?? {}) as any;

    const hadAnyExistingAddressField = Object.values(existingAddress).some(
      (v) => typeof v === 'string' && v.trim().length > 0
    );

    const addressUpdate: Record<string, any> = {
      ...(dto.country !== undefined ? { country: dto.country.trim() } : {}),
      ...(dto.city !== undefined ? { city: dto.city.trim() } : {}),
      ...(dto.region !== undefined ? { region: dto.region.trim() } : {}),
      ...(dto.street !== undefined ? { street: dto.street.trim() } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone.trim() } : {}),
      ...(dto.website !== undefined ? { website: dto.website.trim() } : {}),
    };

    const hasAnyIncomingAddressField = Object.values(addressUpdate).some(
      (v) => typeof v === 'string' && v.trim().length > 0
    );

    const newConfig = {
      ...existingConfig,
      address: {
        ...existingAddress,
        ...addressUpdate,
      },
    } as any;

    // Preserve immutable creator metadata.
    if (existingConfig.createdByUserId) newConfig.createdByUserId = existingConfig.createdByUserId;
    if (existingConfig.createdBy) newConfig.createdBy = existingConfig.createdBy;

    const updated = await this.tenantRepository.updateTenantConfig(user.tenantId, newConfig);

    if (hasAnyIncomingAddressField && user?.sub) {
      await this.notificationService.notifyInstitutionAddressUpdated({
        tenantId: user.tenantId,
        userId: String(user.sub),
        tenantName: tenant.name,
        address: (newConfig.address ?? {}) as any,
        isFirstSet: !hadAnyExistingAddressField,
      });
    }

    return updated;
  }

  async updateTenantLogo(user: any, file: Express.Multer.File) {
    if (!user?.tenantId) {
      throw new UnauthorizedAccessException();
    }

    const roles: string[] = user.roles ?? [];
    if (!roles.includes(ROLES.DEPARTMENT_HEAD) && !roles.includes(ROLES.PLATFORM_ADMIN)) {
      throw new InsufficientPermissionsException();
    }

    if (!file?.buffer) {
      throw new BadRequestException('Logo file is required');
    }

    const tenant = await this.tenantRepository.findTenantById(user.tenantId);
    if (!tenant) {
      throw new UnauthorizedAccessException('Tenant not found');
    }

    const existingConfig = asTenantConfig(tenant.config);
    const existingBranding = (existingConfig.branding ?? {}) as any;
    const hadExistingLogo =
      (typeof existingBranding.logoPublicId === 'string' &&
        existingBranding.logoPublicId.trim().length > 0) ||
      (typeof existingBranding.logoUrl === 'string' && existingBranding.logoUrl.trim().length > 0);
    const oldPublicId: string | undefined =
      typeof existingBranding.logoPublicId === 'string' ? existingBranding.logoPublicId : undefined;

    const uploaded = await this.cloudinaryService.uploadTenantLogo({
      tenantId: user.tenantId,
      buffer: file.buffer,
    });

    // Best-effort cleanup if public id changed (shouldn't for overwrite, but safe).
    if (oldPublicId && oldPublicId !== uploaded.publicId) {
      try {
        await this.cloudinaryService.deleteByPublicId(oldPublicId, 'image');
      } catch {
        // Best-effort
      }
    }

    const newConfig = {
      ...existingConfig,
      branding: {
        ...existingBranding,
        logoUrl: uploaded.secureUrl,
        logoPublicId: uploaded.publicId,
      },
    } as any;

    // Preserve immutable creator metadata.
    if (existingConfig.createdByUserId) newConfig.createdByUserId = existingConfig.createdByUserId;
    if (existingConfig.createdBy) newConfig.createdBy = existingConfig.createdBy;

    const updated = await this.tenantRepository.updateTenantConfig(user.tenantId, newConfig);

    if (user?.sub) {
      await this.notificationService.notifyInstitutionLogoUpdated({
        tenantId: user.tenantId,
        userId: String(user.sub),
        tenantName: tenant.name,
        logoUrl: uploaded.secureUrl,
        isFirstSet: !hadExistingLogo,
      });
    }

    return updated;
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

  async listFaculty(user: any, query: ListFacultyQueryDto) {
    if (!user?.tenantId) {
      throw new UnauthorizedAccessException();
    }

    // Only department head can access faculty in their department
    if (!user.roles?.includes(ROLES.DEPARTMENT_HEAD)) {
      throw new InsufficientPermissionsException();
    }

    const userRecord = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { departmentId: true },
    });

    if (!userRecord?.departmentId) {
      throw new BadRequestException('User is not assigned to a department');
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const search = query.search ?? query.q;

    const roleNames = [ROLES.ADVISOR, ROLES.COORDINATOR];

    const totalPromise = this.tenantRepository.countDepartmentUsers({
      tenantId: user.tenantId,
      departmentId: userRecord.departmentId,
      roleNames,
      search,
    });

    const usersPromise = this.tenantRepository.findDepartmentUsers({
      tenantId: user.tenantId,
      departmentId: userRecord.departmentId,
      roleNames,
      search,
      skip,
      take: limit,
    });

    const [total, users] = (await Promise.all([totalPromise, usersPromise])) as [
      number,
      any[],
    ];

    return {
      users,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async listDepartmentUsersPaged(user: any, query: ListDepartmentUsersQueryDto) {
    if (!user?.tenantId) {
      throw new UnauthorizedAccessException();
    }

    if (!user.roles?.includes(ROLES.DEPARTMENT_HEAD)) {
      throw new InsufficientPermissionsException();
    }

    const userRecord = await this.prisma.user.findUnique({
      where: { id: user.sub },
      select: { departmentId: true },
    });

    if (!userRecord?.departmentId) {
      throw new BadRequestException('User is not assigned to a department');
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const roleNames = query.roleNames?.length ? query.roleNames : undefined;
    const search = query.search;

    // Safety: department heads should not be able to list PlatformAdmin users.
    const allowedRoles = new Set([ROLES.STUDENT, ROLES.ADVISOR, ROLES.COORDINATOR]);
    const normalizedRoles = roleNames
      ? roleNames.map(String).map((r) => r.trim()).filter((r) => allowedRoles.has(r as any))
      : undefined;

    const totalPromise = this.tenantRepository.countDepartmentUsers({
      tenantId: user.tenantId,
      departmentId: userRecord.departmentId,
      roleNames: normalizedRoles,
      search,
    });

    const usersPromise = this.tenantRepository.findDepartmentUsers({
      tenantId: user.tenantId,
      departmentId: userRecord.departmentId,
      roleNames: normalizedRoles,
      search,
      skip,
      take: limit,
    });

    const [total, users] = (await Promise.all([totalPromise, usersPromise])) as [
      number,
      any[],
    ];

    return {
      users,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
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

  async createInvitation(
    user: any,
    data: {
      email: string;
      firstName: string;
      lastName: string;
      roleName: string;
      messageTemplateId?: string;
      subject?: string;
      message?: string;
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
    const firstName = (data.firstName ?? '').trim();
    const lastName = (data.lastName ?? '').trim();

    if (!firstName) {
      throw new BadRequestException('First name is required');
    }
    if (!lastName) {
      throw new BadRequestException('Last name is required');
    }

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

    const customization = await this.resolveInvitationCustomization(user, inviter.departmentId, {
      messageTemplateId: data.messageTemplateId,
      subject: data.subject,
      message: data.message,
    });

    const invitation = await this.invitations.createInvitation({
      tenantId: user.tenantId,
      departmentId: inviter.departmentId,
      email,
      inviteeFirstName: firstName,
      inviteeLastName: lastName,
      roleName: data.roleName,
      invitedByAdminId: inviter.id,
      customSubject: customization.customSubject,
      customMessage: customization.customMessage,
    });

    // Best-effort: notify inviter after a successful send.
    if (invitation.lastSentAt) {
      const inviteeFullName = `${firstName} ${lastName}`.trim();
      try {
        await this.notificationService.createNotification({
          tenantId: user.tenantId,
          userId: inviter.id,
          eventType: NOTIFICATION_EVENT_TYPES.INVITATION_SENT as NotificationEventType,
          severity: NOTIFICATION_SEVERITIES.INFO as NotificationSeverity,
          title: 'Invitation sent',
          message: `Invitation sent to ${inviteeFullName} (${email}).`,
          metadata: {
            invitationId: invitation.id,
            email,
            inviteeFirstName: firstName,
            inviteeLastName: lastName,
            inviteeFullName,
            roleName: data.roleName,
            departmentId: inviter.departmentId,
          },
          idempotencyKey: `invitation_sent:${invitation.id}:${inviter.id}`,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`InvitationNotification: failed (${message})`);
      }
    }

    return {
      id: invitation.id,
      tenantId: invitation.tenantId,
      departmentId: invitation.departmentId,
      email: invitation.email,
      firstName: invitation.inviteeFirstName,
      lastName: invitation.inviteeLastName,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      lastSentAt: invitation.lastSentAt,
      sendCount: invitation.sendCount,
      lastSendError: invitation.lastSendError,
    };
  }

  private async resolveInvitationCustomization(
    user: any,
    departmentId: string,
    data: {
      messageTemplateId?: string;
      subject?: string;
      message?: string;
    }
  ): Promise<{ customSubject?: string; customMessage?: string }> {
    let template: { subject: string | null; message: string | null } | null = null;

    if (data.messageTemplateId) {
      template = await this.prisma.invitationMessageTemplate.findFirst({
        where: {
          id: data.messageTemplateId,
          tenantId: user.tenantId,
          departmentId,
        },
        select: { subject: true, message: true },
      });

      if (!template) {
        throw new NotFoundException('Invitation message template not found');
      }
    }

    const subject = (data.subject ?? '').trim() || template?.subject || undefined;
    const message = (data.message ?? '').trim() || template?.message || undefined;

    return {
      customSubject: subject || undefined,
      customMessage: message || undefined,
    };
  }

  async previewInvitationEmail(
    user: any,
    data: {
      roleName: string;
      firstName?: string;
      lastName?: string;
      messageTemplateId?: string;
      subject?: string;
      message?: string;
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

    const customization = await this.resolveInvitationCustomization(user, inviter.departmentId, {
      messageTemplateId: data.messageTemplateId,
      subject: data.subject,
      message: data.message,
    });

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { id: true, name: true, domain: true },
    });

    const department = await this.prisma.department.findUnique({
      where: { id: inviter.departmentId },
      select: { id: true, name: true },
    });

    const frontendBase = (
      this.configService.get<string>('app.frontendUrl') || 'http://localhost:3000'
    ).replace(/\/$/, '');

    const acceptUrl = `${frontendBase}/invitations/accept?token=preview-token`;

    const loginUrl = tenant?.domain
      ? `${frontendBase}/login?tenantDomain=${encodeURIComponent(tenant.domain)}`
      : `${frontendBase}/login`;

    const expiryDays = this.configService.get<number>('email.invitationExpiryDays') || 7;
    const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

    const built = buildInvitationEmailContent({
      commonTemplateParams: this.emailService.getCommonTemplateParams(),
      tenantName: tenant?.name ?? 'Academia',
      tenantDomain: tenant?.domain ?? undefined,
      inviteeFirstName: (data.firstName ?? '').trim() || undefined,
      inviteeLastName: (data.lastName ?? '').trim() || undefined,
      roleName: data.roleName,
      departmentName: department?.name ?? undefined,
      acceptUrl,
      loginUrl,
      expiresAt,
      customSubject: customization.customSubject,
      customMessage: customization.customMessage,
    });

    return {
      subject: built.subject,
      htmlContent: built.htmlContent,
      textContent: built.textContent,
      templateParams: built.templateParams,
      acceptUrl,
      loginUrl,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async createInvitationMessageTemplate(
    user: any,
    data: { name: string; subject?: string; message?: string }
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

    const created = await this.prisma.invitationMessageTemplate.create({
      data: {
        tenantId: user.tenantId,
        departmentId: inviter.departmentId,
        name: (data.name ?? '').trim(),
        subject: (data.subject ?? '').trim() || null,
        message: (data.message ?? '').trim() || null,
        createdById: inviter.id,
      },
      select: {
        id: true,
        tenantId: true,
        departmentId: true,
        name: true,
        subject: true,
        message: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return created;
  }

  async listInvitationMessageTemplates(user: any) {
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

    return this.prisma.invitationMessageTemplate.findMany({
      where: {
        tenantId: user.tenantId,
        departmentId: inviter.departmentId,
      },
      select: {
        id: true,
        tenantId: true,
        departmentId: true,
        name: true,
        subject: true,
        message: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateInvitationMessageTemplate(
    user: any,
    templateId: string,
    data: { name?: string; subject?: string; message?: string }
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

    const existing = await this.prisma.invitationMessageTemplate.findFirst({
      where: {
        id: templateId,
        tenantId: user.tenantId,
        departmentId: inviter.departmentId,
      },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Invitation message template not found');
    }

    return this.prisma.invitationMessageTemplate.update({
      where: { id: templateId },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.subject !== undefined ? { subject: data.subject.trim() || null } : {}),
        ...(data.message !== undefined ? { message: data.message.trim() || null } : {}),
      },
      select: {
        id: true,
        tenantId: true,
        departmentId: true,
        name: true,
        subject: true,
        message: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async deleteInvitationMessageTemplate(user: any, templateId: string) {
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

    const existing = await this.prisma.invitationMessageTemplate.findFirst({
      where: {
        id: templateId,
        tenantId: user.tenantId,
        departmentId: inviter.departmentId,
      },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Invitation message template not found');
    }

    await this.prisma.invitationMessageTemplate.delete({ where: { id: templateId } });

    return { deleted: true, id: templateId };
  }

  async listInvitations(
    user: any,
    params?: {
      status?: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
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

    const status = params?.status ?? 'PENDING';
    const allowedStatuses = ['PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED'] as const;
    if (!allowedStatuses.includes(status)) {
      throw new BadRequestException('Invalid invitation status');
    }

    const invitations = await this.prisma.invitation.findMany({
      where: {
        tenantId: user.tenantId,
        departmentId: inviter.departmentId,
        status,
      },
      select: {
        id: true,
        tenantId: true,
        departmentId: true,
        email: true,
        inviteeFirstName: true,
        inviteeLastName: true,
        status: true,
        expiresAt: true,
        createdAt: true,
        acceptedAt: true,
        revokedAt: true,
        lastSentAt: true,
        sendCount: true,
        lastSendError: true,
        role: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return invitations.map((inv) => ({
      id: inv.id,
      tenantId: inv.tenantId,
      departmentId: inv.departmentId,
      email: inv.email,
      firstName: inv.inviteeFirstName,
      lastName: inv.inviteeLastName,
      roleName: inv.role?.name,
      status: inv.status,
      expiresAt: inv.expiresAt,
      createdAt: inv.createdAt,
      acceptedAt: inv.acceptedAt,
      revokedAt: inv.revokedAt,
      lastSentAt: inv.lastSentAt,
      sendCount: inv.sendCount,
      lastSendError: inv.lastSendError,
    }));
  }

  async listInvitationsPaged(user: any, query: ListInvitationsPagedQueryDto) {
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

    const status = query.status;
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const search = (query.search ?? '').trim() || undefined;

    const allowedRoles = new Set([ROLES.STUDENT, ROLES.ADVISOR, ROLES.COORDINATOR]);
    const normalizedRoleNames = query.roleNames?.length
      ? query.roleNames
          .map(String)
          .map((r) => r.trim())
          .filter((r) => allowedRoles.has(r as any))
      : undefined;

    const where: any = {
      tenantId: user.tenantId,
      departmentId: inviter.departmentId,
      ...(status ? { status } : {}),
      ...(normalizedRoleNames?.length
        ? {
            role: {
              name: {
                in: normalizedRoleNames,
              },
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' as const } },
              { inviteeFirstName: { contains: search, mode: 'insensitive' as const } },
              { inviteeLastName: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const totalPromise = this.prisma.invitation.count({ where });
    const invitationsPromise = this.prisma.invitation.findMany({
      where,
      select: {
        id: true,
        tenantId: true,
        departmentId: true,
        email: true,
        inviteeFirstName: true,
        inviteeLastName: true,
        status: true,
        expiresAt: true,
        createdAt: true,
        acceptedAt: true,
        revokedAt: true,
        lastSentAt: true,
        sendCount: true,
        lastSendError: true,
        role: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });

    const [total, invitations] = (await Promise.all([totalPromise, invitationsPromise])) as [
      number,
      any[],
    ];

    return {
      invitations: invitations.map((inv) => ({
        id: inv.id,
        tenantId: inv.tenantId,
        departmentId: inv.departmentId,
        email: inv.email,
        firstName: inv.inviteeFirstName,
        lastName: inv.inviteeLastName,
        roleName: inv.role?.name,
        status: inv.status,
        expiresAt: inv.expiresAt,
        createdAt: inv.createdAt,
        acceptedAt: inv.acceptedAt,
        revokedAt: inv.revokedAt,
        lastSentAt: inv.lastSentAt,
        sendCount: inv.sendCount,
        lastSendError: inv.lastSendError,
      })),
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async revokeInvitation(user: any, invitationId: string) {
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

    const invitation = await this.prisma.invitation.findFirst({
      where: {
        id: invitationId,
        tenantId: user.tenantId,
        departmentId: inviter.departmentId,
      },
      select: {
        id: true,
        tenantId: true,
        departmentId: true,
        email: true,
        status: true,
        expiresAt: true,
        createdAt: true,
        role: { select: { name: true } },
      },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status === 'ACCEPTED') {
      throw new BadRequestException('Cannot revoke an accepted invitation');
    }

    if (invitation.status === 'REVOKED') {
      return {
        id: invitation.id,
        tenantId: invitation.tenantId,
        departmentId: invitation.departmentId,
        email: invitation.email,
        roleName: invitation.role?.name,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
      };
    }

    const updated = await this.prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: 'REVOKED', revokedAt: new Date(), revokedById: inviter.id },
      select: {
        id: true,
        tenantId: true,
        departmentId: true,
        email: true,
        status: true,
        expiresAt: true,
        createdAt: true,
        revokedAt: true,
        acceptedAt: true,
        lastSentAt: true,
        sendCount: true,
        lastSendError: true,
        role: { select: { name: true } },
      },
    });

    return {
      id: updated.id,
      tenantId: updated.tenantId,
      departmentId: updated.departmentId,
      email: updated.email,
      roleName: updated.role?.name,
      status: updated.status,
      expiresAt: updated.expiresAt,
      createdAt: updated.createdAt,
      revokedAt: updated.revokedAt,
      acceptedAt: updated.acceptedAt,
      lastSentAt: updated.lastSentAt,
      sendCount: updated.sendCount,
      lastSendError: updated.lastSendError,
    };
  }

  async resendInvitation(user: any, invitationId: string) {
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

    const invitation = await this.prisma.invitation.findFirst({
      where: {
        id: invitationId,
        tenantId: user.tenantId,
        departmentId: inviter.departmentId,
      },
      select: {
        id: true,
        tenantId: true,
        departmentId: true,
        email: true,
        inviteeFirstName: true,
        inviteeLastName: true,
        status: true,
        role: { select: { name: true } },
      },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status === 'ACCEPTED') {
      throw new BadRequestException('Cannot resend an accepted invitation');
    }

    if (invitation.status === 'REVOKED') {
      throw new BadRequestException('Cannot resend a revoked invitation');
    }

    // Invalidate old token immediately.
    await this.prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: 'REVOKED', revokedAt: new Date(), revokedById: inviter.id },
    });

    const roleName = invitation.role?.name;
    if (!roleName) {
      throw new BadRequestException('Invitation role is missing');
    }

    const inviteeFirstName = (invitation.inviteeFirstName ?? '').trim();
    const inviteeLastName = (invitation.inviteeLastName ?? '').trim();
    if (!inviteeFirstName || !inviteeLastName) {
      throw new BadRequestException('Invitation is missing invitee name');
    }

    const newInvitation = await this.invitations.createInvitation({
      tenantId: invitation.tenantId,
      departmentId: invitation.departmentId ?? undefined,
      email: invitation.email,
      inviteeFirstName,
      inviteeLastName,
      roleName,
      invitedByAdminId: inviter.id,
    });

    // Best-effort: notify inviter after a successful send.
    if (newInvitation.lastSentAt) {
      const inviteeFullName = `${inviteeFirstName} ${inviteeLastName}`.trim();
      try {
        await this.notificationService.createNotification({
          tenantId: invitation.tenantId,
          userId: inviter.id,
          eventType: NOTIFICATION_EVENT_TYPES.INVITATION_SENT as NotificationEventType,
          severity: NOTIFICATION_SEVERITIES.INFO as NotificationSeverity,
          title: 'Invitation resent',
          message: `Invitation resent to ${inviteeFullName} (${invitation.email}).`,
          metadata: {
            invitationId: newInvitation.id,
            previousInvitationId: invitation.id,
            email: invitation.email,
            inviteeFirstName,
            inviteeLastName,
            inviteeFullName,
            roleName,
            departmentId: invitation.departmentId,
          },
          idempotencyKey: `invitation_resent:${newInvitation.id}:${inviter.id}`,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`InvitationResendNotification: failed (${message})`);
      }
    }

    return {
      id: newInvitation.id,
      tenantId: newInvitation.tenantId,
      departmentId: newInvitation.departmentId,
      email: newInvitation.email,
      firstName: newInvitation.inviteeFirstName,
      lastName: newInvitation.inviteeLastName,
      status: newInvitation.status,
      expiresAt: newInvitation.expiresAt,
      lastSentAt: newInvitation.lastSentAt,
      sendCount: newInvitation.sendCount,
      lastSendError: newInvitation.lastSendError,
    };
  }

  async bulkInviteStudents(
    user: any,
    data: {
      invites: Array<{ email: string; firstName: string; lastName: string }>;
      messageTemplateId?: string;
      subject?: string;
      message?: string;
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

    const rawInvites = Array.isArray(data?.invites) ? data.invites : [];
    if (rawInvites.length === 0) {
      throw new BadRequestException('At least one invite is required');
    }
    if (rawInvites.length > 50) {
      throw new BadRequestException('Bulk invite supports a maximum of 50 invites per request');
    }

    const normalizedInvites = rawInvites
      .map((i) => ({
        email: (i?.email ?? '').trim().toLowerCase(),
        firstName: (i?.firstName ?? '').trim(),
        lastName: (i?.lastName ?? '').trim(),
      }))
      .filter((i) => i.email);

    if (normalizedInvites.length === 0) {
      throw new BadRequestException('At least one valid invite is required');
    }

    for (const inv of normalizedInvites) {
      if (!inv.firstName) throw new BadRequestException('Each invite must include firstName');
      if (!inv.lastName) throw new BadRequestException('Each invite must include lastName');
    }

    const seen = new Set<string>();
    const uniqueInvites: Array<{ email: string; firstName: string; lastName: string }> = [];
    const duplicates: string[] = [];
    for (const inv of normalizedInvites) {
      if (seen.has(inv.email)) {
        duplicates.push(inv.email);
        continue;
      }
      seen.add(inv.email);
      uniqueInvites.push(inv);
    }

    const uniqueEmails = uniqueInvites.map((i) => i.email);

    const existingUsers = await this.prisma.user.findMany({
      where: {
        tenantId: user.tenantId,
        email: { in: uniqueEmails },
      },
      select: { email: true },
    });

    const existingEmailSet = new Set(existingUsers.map((u) => u.email.toLowerCase()));
    const toInvite = uniqueInvites.filter((i) => !existingEmailSet.has(i.email));

    // Nothing to do (all exist already)
    if (toInvite.length === 0) {
      return {
        requested: rawInvites.length,
        unique: uniqueEmails.length,
        created: 0,
        skippedExisting: uniqueEmails.length,
        duplicates,
        invitations: [],
      };
    }

    const expiryDays = this.configService.get<number>('email.invitationExpiryDays') || 7;
    const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

    const role = await this.prisma.role.findFirst({ where: { name: ROLES.STUDENT } });
    if (!role) {
      throw new BadRequestException(`Role not found: ${ROLES.STUDENT}`);
    }

    const createdInvitations = await this.prisma.$transaction(async (tx) => {
      await tx.invitation.updateMany({
        where: {
          tenantId: user.tenantId,
          departmentId: inviter.departmentId,
          email: { in: toInvite.map((i) => i.email) },
          roleId: role.id,
          status: 'PENDING',
        },
        data: { status: 'REVOKED', revokedAt: new Date(), revokedById: inviter.id },
      });

      const results: Array<{
        id: string;
        tenantId: string;
        departmentId: string | null;
        email: string;
        inviteeFirstName: string | null;
        inviteeLastName: string | null;
        status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
        expiresAt: Date;
        token: string;
      }> = [];

      for (const inv of toInvite) {
        const token = randomBytes(32).toString('hex');
        const created = await tx.invitation.create({
          data: {
            tenantId: user.tenantId,
            departmentId: inviter.departmentId,
            email: inv.email,
            inviteeFirstName: inv.firstName,
            inviteeLastName: inv.lastName,
            roleId: role.id,
            token,
            status: 'PENDING',
            expiresAt,
            invitedById: inviter.id,
          },
          select: {
            id: true,
            tenantId: true,
            departmentId: true,
            email: true,
            inviteeFirstName: true,
            inviteeLastName: true,
            status: true,
            expiresAt: true,
            token: true,
          },
        });
        results.push(created);
      }

      return results;
    });

    const customization = await this.resolveInvitationCustomization(user, inviter.departmentId, {
      messageTemplateId: data.messageTemplateId,
      subject: data.subject,
      message: data.message,
    });

    // Best-effort email dispatch (worker queue will be used when enabled).
    await Promise.allSettled(
      createdInvitations.map((inv) =>
        this.invitations.sendInvitationEmail({
          invitationId: inv.id,
          tenantId: inv.tenantId,
          departmentId: inv.departmentId,
          email: inv.email,
          inviteeFirstName: inv.inviteeFirstName ?? undefined,
          inviteeLastName: inv.inviteeLastName ?? undefined,
          roleName: ROLES.STUDENT,
          token: inv.token,
          expiresAt: inv.expiresAt,
          customSubject: customization.customSubject,
          customMessage: customization.customMessage,
        })
      )
    );

    // Re-fetch so audit fields reflect send attempts.
    const refreshed = await this.prisma.invitation.findMany({
      where: { id: { in: createdInvitations.map((i) => i.id) } },
      select: {
        id: true,
        tenantId: true,
        departmentId: true,
        email: true,
        inviteeFirstName: true,
        inviteeLastName: true,
        status: true,
        expiresAt: true,
        createdAt: true,
        acceptedAt: true,
        revokedAt: true,
        lastSentAt: true,
        sendCount: true,
        lastSendError: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Best-effort: notify inviter with a single summary (no per-student spam).
    try {
      const sent = refreshed.filter((i) => i.lastSentAt).length;
      const failed = refreshed.filter((i) => i.lastSendError).length;
      const severity =
        sent > 0
          ? (NOTIFICATION_SEVERITIES.INFO as NotificationSeverity)
          : (NOTIFICATION_SEVERITIES.HIGH as NotificationSeverity);

      await this.notificationService.createNotification({
        tenantId: user.tenantId,
        userId: inviter.id,
        eventType: NOTIFICATION_EVENT_TYPES.INVITATIONS_BULK_SENT as NotificationEventType,
        severity,
        title: 'Bulk invitations processed',
        message: `Bulk student invitations processed: ${sent}/${createdInvitations.length} sent, ${failed} failed.`,
        metadata: {
          requested: rawInvites.length,
          unique: uniqueEmails.length,
          created: createdInvitations.length,
          sent,
          failed,
          skippedExisting: uniqueEmails.length - toInvite.length,
          duplicates,
          departmentId: inviter.departmentId,
        },
        idempotencyKey: `bulk_invite_students_processed:${createdInvitations.length}:${inviter.id}:${Date.now()}`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`BulkInviteNotification: failed (${message})`);
    }

    return {
      requested: rawInvites.length,
      unique: uniqueEmails.length,
      created: createdInvitations.length,
      skippedExisting: uniqueEmails.length - toInvite.length,
      duplicates,
      invitations: refreshed.map((inv) => ({
        id: inv.id,
        tenantId: inv.tenantId,
        departmentId: inv.departmentId,
        email: inv.email,
        firstName: inv.inviteeFirstName,
        lastName: inv.inviteeLastName,
        roleName: ROLES.STUDENT,
        status: inv.status,
        expiresAt: inv.expiresAt,
        createdAt: inv.createdAt,
        acceptedAt: inv.acceptedAt,
        revokedAt: inv.revokedAt,
        lastSentAt: inv.lastSentAt,
        sendCount: inv.sendCount,
        lastSendError: inv.lastSendError,
      })),
    };
  }

  async enqueueBulkInviteStudentsJob(
    user: any,
    data: {
      invites: Array<{ email: string; firstName: string; lastName: string }>;
      messageTemplateId?: string;
      subject?: string;
      message?: string;
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

    const rawInvites = Array.isArray(data?.invites) ? data.invites : [];
    if (rawInvites.length === 0) {
      throw new BadRequestException('At least one invite is required');
    }
    if (rawInvites.length > 50) {
      throw new BadRequestException('Bulk invite supports a maximum of 50 invites per request');
    }

    const normalizedInvites = rawInvites
      .map((i) => ({
        email: (i?.email ?? '').trim().toLowerCase(),
        firstName: (i?.firstName ?? '').trim(),
        lastName: (i?.lastName ?? '').trim(),
      }))
      .filter((i) => i.email);

    if (normalizedInvites.length === 0) {
      throw new BadRequestException('At least one valid invite is required');
    }

    for (const inv of normalizedInvites) {
      if (!inv.firstName) throw new BadRequestException('Each invite must include firstName');
      if (!inv.lastName) throw new BadRequestException('Each invite must include lastName');
    }

    const customization = await this.resolveInvitationCustomization(user, inviter.departmentId, {
      messageTemplateId: data.messageTemplateId,
      subject: data.subject,
      message: data.message,
    });

    const jobId = await this.queueService.addBulkInviteStudentsJob({
      tenantId: user.tenantId,
      inviterId: inviter.id,
      departmentId: inviter.departmentId,
      invites: normalizedInvites,
      customSubject: customization.customSubject,
      customMessage: customization.customMessage,
    });

    return {
      jobId,
      enqueued: true,
      requested: rawInvites.length,
      maxPerRequest: 50,
    };
  }

  async getBulkInviteStudentsJobStatus(user: any, jobId: string) {
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

    const job = await this.queueService.getBulkInviteStudentsJob(jobId);
    if (!job) {
      throw new NotFoundException('Job not found');
    }

    const data: any = job.data ?? {};
    if (
      data.tenantId !== user.tenantId ||
      data.inviterId !== inviter.id ||
      data.departmentId !== inviter.departmentId
    ) {
      throw new NotFoundException('Job not found');
    }

    const state = await job.getState();
    const progress = job.progress();

    return {
      jobId: String(job.id),
      state,
      progress,
      createdAt: job.timestamp ? new Date(job.timestamp).toISOString() : undefined,
      finishedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : undefined,
      failedReason: job.failedReason || undefined,
      result: state === 'completed' ? job.returnvalue : undefined,
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
