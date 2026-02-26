import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { EmailVerificationRequestDto } from './dto/email-verification-request.dto';
import { EmailVerificationVerifyDto } from './dto/email-verification-verify.dto';
import { EmailService } from '../../core/email/email.service';
import { QueueService } from '../../core/queue/queue.service';
import { NotificationService } from '../notification/notification.service';
import { AuthRepository } from './auth.repository';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordRequestDto } from './dto/forgot-password-request.dto';
import { ForgotPasswordVerifyDto } from './dto/forgot-password-verify.dto';
import { ForgotPasswordResetDto } from './dto/forgot-password-reset.dto';
import {
  InvalidCredentialsException,
  EmailAlreadyRegisteredException,
  UserNotFoundException,
  AccountInactiveException,
  TenantInactiveException,
  InvalidRefreshTokenException,
  PasswordNotSetException,
  IncorrectPasswordException,
  InvalidPasswordResetOtpException,
  InvalidPasswordResetTokenException,
  PasswordResetOtpLockedException,
  NoActivePasswordResetException,
  UnauthorizedAccessException,
} from '../../common/exceptions';
import { ROLES } from '../../common/constants/roles.constants';
import {
  generateNumericOtp,
  generateOtpSalt,
  hashOtp,
  PASSWORD_RESET_OTP_TTL_MINUTES,
} from './utils/password-reset-otp.util';

const maskEmailForLogs = (email: string): string => {
  const trimmed = email.trim();
  const at = trimmed.indexOf('@');
  if (at <= 1) return '***';
  const name = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  return `${name[0]}***@${domain}`;
};

type JwtExpiresIn = NonNullable<JwtSignOptions['expiresIn']>;

type PasswordResetTokenPayload = {
  purpose: 'password-reset';
  sub: string;
  email: string;
  tenantId: string;
  otpId: string;
};

const asJwtExpiresIn = (value: unknown): JwtExpiresIn => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) return '15m' as JwtExpiresIn;
    const maybeNumber = Number(trimmed);
    if (!Number.isNaN(maybeNumber) && Number.isFinite(maybeNumber)) {
      return maybeNumber;
    }
    return trimmed as JwtExpiresIn;
  }
  return '15m' as JwtExpiresIn;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private authRepository: AuthRepository,
    private jwtService: JwtService,
    private configService: ConfigService,
    private queueService: QueueService,
    private emailService: EmailService,
    private notificationService: NotificationService
  ) {}

  private getPasswordResetOtpPepper(): string {
    // Use a dedicated env var if you want; fallback to JWT secret.
    return (
      this.configService.get<string>('auth.passwordResetOtpPepper') ||
      this.configService.get<string>('PASSWORD_RESET_OTP_PEPPER') ||
      this.configService.getOrThrow<string>('auth.jwtSecret')
    );
  }

  private getAppName(): string {
    return (
      this.configService.get<string>('app.name') ||
      process.env.APP_NAME ||
      'Academic Project Platform'
    );
  }

  async validateUser(email: string, password: string, tenantDomain?: string): Promise<any> {
    const normalizedEmail = email.trim();

    // If tenantDomain is omitted, infer the tenant from the (globally-unique) email.
    // This avoids accidental defaulting to the "system" tenant which would break normal tenant logins.
    const tenant = await this.resolveTenantForEmailVerification(normalizedEmail, tenantDomain);

    if (!tenant) {
      throw new InvalidCredentialsException();
    }

    const user = await this.authRepository.findUserByEmailAndTenant(normalizedEmail, tenant.id);

    if (!user) {
      throw new InvalidCredentialsException();
    }

    if (!user.hashedPassword) {
      throw new InvalidCredentialsException();
    }

    const isPasswordValid = await bcrypt.compare(password, user.hashedPassword);

    if (!isPasswordValid) {
      throw new InvalidCredentialsException();
    }

    if (user.status !== 'ACTIVE') {
      throw new AccountInactiveException();
    }

    // Check tenant status (skip only for system tenant)
    if (user.tenant.domain !== 'system' && user.tenant.status !== 'ACTIVE') {
      throw new TenantInactiveException();
    }

    // When logging into the system tenant, require PlatformAdmin role
    if (
      user.tenant.domain === 'system' &&
      !user.roles.some((ur: { role: { name: string } }) => ur.role.name === 'PlatformAdmin')
    ) {
      throw new InvalidCredentialsException();
    }

    return user;
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password, loginDto.tenantDomain);

    // Update last login
    await this.authRepository.updateUserLastLogin(user.id);

    const payload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId || 'system',
      roles: user.roles.map((ur: { role: { name: string } }) => ur.role.name),
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.getOrThrow<string>('auth.refreshSecret'),
      expiresIn: asJwtExpiresIn(this.configService.get('auth.refreshExpiresIn')),
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
        roles: user.roles.map((ur: { role: { name: string } }) => ur.role.name),
        tenantId: user.tenantId,
      },
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.getOrThrow<string>('auth.refreshSecret'),
      });

      const user = await this.authRepository.findUserById(payload.sub);

      if (!user || user.status !== 'ACTIVE') {
        throw new UserNotFoundException('User not found or inactive');
      }

      const newPayload = {
        sub: user.id,
        email: user.email,
        tenantId: user.tenantId || 'system',
        roles: user.roles.map((ur: { role: { name: string } }) => ur.role.name),
      };

      const newAccessToken = this.jwtService.sign(newPayload);
      const newRefreshToken = this.jwtService.sign(newPayload, {
        secret: this.configService.getOrThrow<string>('auth.refreshSecret'),
        expiresIn: asJwtExpiresIn(this.configService.get('auth.refreshExpiresIn')),
      });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch {
      throw new InvalidRefreshTokenException();
    }
  }

  async me(user: any) {
    if (!user?.sub) {
      throw new UnauthorizedAccessException();
    }

    const dbUser = await this.authRepository.findUserById(user.sub);
    if (!dbUser) {
      throw new UnauthorizedAccessException();
    }

    // Defensive tenant check in case of mismatched/legacy tokens.
    if (user.tenantId && user.tenantId !== 'system' && dbUser.tenantId !== user.tenantId) {
      throw new UnauthorizedAccessException();
    }

    const department = dbUser.departmentId
      ? await this.authRepository.findDepartmentById(dbUser.departmentId)
      : null;

    const roleNames = dbUser.roles.map((ur: { role: { name: string } }) => ur.role.name);
    const shouldIncludeTenantVerification =
      dbUser.tenantId !== 'system' && roleNames.includes(ROLES.DEPARTMENT_HEAD);

    const latestVerificationRequest = shouldIncludeTenantVerification
      ? await this.authRepository.findLatestTenantVerificationRequest(dbUser.tenantId)
      : null;

    return {
      id: dbUser.id,
      email: dbUser.email,
      firstName: dbUser.firstName,
      lastName: dbUser.lastName,
      avatarUrl: dbUser.avatarUrl,
      avatarPublicId: dbUser.avatarPublicId,
      status: dbUser.status,
      emailVerified: dbUser.emailVerified,
      tenantId: dbUser.tenantId,
      tenantDomain: dbUser.tenant?.domain ?? null,
      tenant: dbUser.tenant
        ? {
            id: dbUser.tenant.id,
            name: dbUser.tenant.name,
            domain: dbUser.tenant.domain,
            status: dbUser.tenant.status,
          }
        : null,
      departmentId: dbUser.departmentId ?? null,
      departmentName: department?.name ?? null,
      department,
      roles: roleNames,
      lastLoginAt: dbUser.lastLoginAt,
      twoFactorEnabled: dbUser.twoFactorEnabled,
      twoFactorVerifiedAt: dbUser.twoFactorVerifiedAt,
      tenantVerification: shouldIncludeTenantVerification
        ? {
            status: latestVerificationRequest?.status ?? null,
            isPending: latestVerificationRequest?.status === 'PENDING',
            lastSubmittedAt: latestVerificationRequest?.createdAt ?? null,
            lastReviewedAt: latestVerificationRequest?.reviewedAt ?? null,
            lastReviewReason: latestVerificationRequest?.reviewReason ?? null,
          }
        : null,
    };
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await this.authRepository.findUserById(userId);

    if (!user) {
      throw new UserNotFoundException();
    }

    if (!user.hashedPassword) {
      throw new PasswordNotSetException();
    }

    const isPasswordValid = await bcrypt.compare(oldPassword, user.hashedPassword);

    if (!isPasswordValid) {
      throw new IncorrectPasswordException();
    }

    const rounds = this.configService.getOrThrow<number>('auth.bcryptRounds');
    const hashedPassword = await bcrypt.hash(newPassword, rounds);

    await this.authRepository.updateUserPassword(userId, hashedPassword);

    // Notify user about password change (best-effort)
    try {
      await this.notificationService.notifyPasswordChanged(user.tenantId, user.id);
    } catch (notificationError) {
      this.logger.error(`Failed to send password changed notification: ${notificationError}`);
      // Don't fail the password change flow
    }

    return { message: 'Password changed successfully' };
  }

  async registerInstitution(registerDto: {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    universityName: string;
    departmentName: string;
    departmentCode: string;
    departmentDescription?: string;
  }) {
    // Check if email already exists globally
    const existingUser = await this.authRepository.findUserByEmailGlobally(registerDto.email);
    if (existingUser) {
      throw new EmailAlreadyRegisteredException('Email already registered');
    }

    // Generate unique domain from university name
    const baseDomain = registerDto.universityName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 20);

    let domain = baseDomain;
    let counter = 1;

    // Ensure domain uniqueness
    while (await this.authRepository.findTenantByDomain(domain)) {
      domain = `${baseDomain}${counter}`;
      counter++;
      if (counter > 100) {
        throw new Error('Unable to generate unique domain for institution');
      }
    }

    // Hash password
    const rounds = this.configService.getOrThrow<number>('auth.bcryptRounds');
    const hashedPassword = await bcrypt.hash(registerDto.password, rounds);

    // Create institution (tenant), department, and department head in a transaction
    const result = await this.authRepository.createInstitutionWithDepartmentHead({
      // Tenant data
      tenantName: registerDto.universityName,
      tenantDomain: domain,

      // Department data
      departmentName: registerDto.departmentName,
      departmentCode: registerDto.departmentCode,
      departmentDescription: registerDto.departmentDescription,

      // User data
      email: registerDto.email,
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
      hashedPassword,
    });

    // Send email verification OTP. Login is blocked until user becomes ACTIVE.
    await this.requestEmailVerification({
      email: registerDto.email,
      tenantDomain: result.tenant.domain,
    });

    return {
      institution: {
        id: result.tenant.id,
        name: result.tenant.name,
        domain: result.tenant.domain,
      },
      department: {
        id: result.department.id,
        name: result.department.name,
        code: result.department.code,
      },
      departmentHead: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        role: 'DepartmentHead',
      },
      nextSteps: [
        'Your institution has been created successfully',
        'Verify your email address using the code sent to your email',
        'After verification, you can login with your email and password',
        'Start managing your department users and academic projects',
      ],
    };
  }

  // ========================
  // EMAIL VERIFICATION (EMAIL + OTP)
  // ========================

  async requestEmailVerification(dto: EmailVerificationRequestDto) {
    const generic = {
      message: 'If an account exists for that email, a verification code has been sent.',
    };

    const email = dto.email.trim().toLowerCase();
    const tenant = await this.resolveTenantForEmailVerification(email, dto.tenantDomain);
    if (!tenant) return generic;

    const user = await this.authRepository.findUserByEmailAndTenant(email, tenant.id);
    if (!user) return generic;

    if (user.emailVerified) {
      return { message: 'Email is already verified.' };
    }

    // Minimum 60s between sends
    const latest = await this.authRepository.findLatestEmailVerificationOtp(tenant.id, email);
    if (latest?.createdAt) {
      const elapsedMs = Date.now() - new Date(latest.createdAt).getTime();
      if (elapsedMs < 60_000) {
        return generic;
      }
    }

    const otp = generateNumericOtp(6);
    const salt = generateOtpSalt();
    const pepper = this.getPasswordResetOtpPepper();
    const otpHash = hashOtp(otp, salt, pepper);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_OTP_TTL_MINUTES * 60_000);

    await this.authRepository.deleteActiveEmailVerificationOtps(tenant.id, email);
    await this.authRepository.createEmailVerificationOtp({
      tenantId: tenant.id,
      email,
      userId: user.id,
      otpHash,
      otpSalt: salt,
      expiresAt,
    });

    const appName = this.getAppName();
    const minutes = PASSWORD_RESET_OTP_TTL_MINUTES;

    const templateId = this.configService.get<number>('email.emailVerificationOtpTemplateId');
    const recipientName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || email;

    const department = user.departmentId
      ? await this.authRepository.findDepartmentById(user.departmentId)
      : null;

    const roleNames: string[] = Array.isArray(user.roles)
      ? user.roles.map((ur: any) => ur?.role?.name).filter(Boolean)
      : [];
    const recipientRole = roleNames.includes('DepartmentHead')
      ? 'Department Head'
      : roleNames.length > 0
        ? roleNames.join(', ')
        : 'User';

    const templateParams = {
      ...this.emailService.getCommonTemplateParams(),
      recipientName,
      institutionName: tenant.name,
      departmentName: department?.name ?? undefined,
      departmentCode: department?.code ?? undefined,
      recipientRole,
      otp,
      expiresMinutes: minutes,
    };

    const emailJob = {
      to: { email, name: `${user.firstName} ${user.lastName}`.trim() || undefined },
      subject: `${appName} — Verify your email`,
      htmlContent: `
          <div style="font-family: Arial, sans-serif; line-height: 1.5;">
            <h2>${appName}</h2>
            <p>Hello${user.firstName ? ` ${user.firstName}` : ''},</p>
            <p>Use the following verification code to verify your email address:</p>
            <p style="font-size: 24px; font-weight: bold; letter-spacing: 2px;">${otp}</p>
            <p>This code expires in <b>${minutes} minutes</b>.</p>
            <p>If you didn’t request this, you can safely ignore this email.</p>
          </div>
        `,
      textContent: `${appName} email verification code: ${otp}. Expires in ${minutes} minutes.`,
    };

    try {
      const workerEnabled = (process.env.WORKER ?? '').toLowerCase() === 'true';
      const isDev = (process.env.NODE_ENV ?? 'development').toLowerCase() !== 'production';

      if (workerEnabled) {
        this.logger.log(
          `EmailVerification: enqueue transactional email to=${maskEmailForLogs(email)} tenant=${tenant.domain}`
        );
        if (templateId) {
          await this.queueService.addTransactionalTemplateEmailJob({
            to: emailJob.to,
            templateId,
            params: templateParams,
          });
        } else {
          await this.queueService.addTransactionalEmailJob(emailJob);
        }
      } else if (isDev) {
        this.logger.warn(
          `EmailVerification: WORKER not enabled; sending directly to=${maskEmailForLogs(email)} tenant=${tenant.domain}`
        );
        if (templateId) {
          await this.emailService.sendTransactionalTemplateEmail({
            to: emailJob.to,
            templateId,
            params: templateParams,
          });
        } else {
          await this.emailService.sendTransactionalEmail(emailJob);
        }
      } else {
        this.logger.log(
          `EmailVerification: enqueue (non-worker) to=${maskEmailForLogs(email)} tenant=${tenant.domain}`
        );
        if (templateId) {
          await this.queueService.addTransactionalTemplateEmailJob({
            to: emailJob.to,
            templateId,
            params: templateParams,
          });
        } else {
          await this.queueService.addTransactionalEmailJob(emailJob);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `EmailVerification: failed to send/enqueue to=${maskEmailForLogs(email)} tenant=${tenant.domain} (${message})`
      );

      // Fallback: try direct-send once.
      try {
        this.logger.warn(
          `EmailVerification: fallback direct send to=${maskEmailForLogs(email)} tenant=${tenant.domain}`
        );
        if (templateId) {
          await this.emailService.sendTransactionalTemplateEmail({
            to: emailJob.to,
            templateId,
            params: templateParams,
          });
        } else {
          await this.emailService.sendTransactionalEmail(emailJob);
        }
      } catch {
        return generic;
      }
    }

    return generic;
  }

  async resendEmailVerification(dto: EmailVerificationRequestDto) {
    // Same behavior as request; throttling handled at controller.
    return this.requestEmailVerification(dto);
  }

  async verifyEmailVerificationOtp(dto: EmailVerificationVerifyDto) {
    const email = dto.email.trim().toLowerCase();
    const otp = dto.otp.trim();

    const tenant = await this.resolveTenantForEmailVerification(email, dto.tenantDomain);
    if (!tenant) throw new BadRequestException('Invalid tenant domain');

    const record = await this.authRepository.findLatestEmailVerificationOtp(tenant.id, email);
    if (!record || record.usedAt) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    const now = new Date();
    if (record.lockedUntil && record.lockedUntil > now) {
      throw new BadRequestException('Too many attempts. Try again later.');
    }

    if (record.expiresAt <= now) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    const pepper = this.getPasswordResetOtpPepper();
    const expected = hashOtp(otp, record.otpSalt, pepper);

    if (expected !== record.otpHash) {
      const nextAttempts = (record.attempts ?? 0) + 1;
      let lockedUntil: Date | null = null;
      if (nextAttempts >= 5) {
        lockedUntil = new Date(Date.now() + 15 * 60_000);
      }

      await this.authRepository.updateEmailVerificationOtpAttempts(record.id, {
        attempts: nextAttempts,
        lockedUntil,
      });

      throw new BadRequestException('Invalid or expired verification code');
    }

    await this.authRepository.markEmailVerificationOtpUsed(record.id);

    if (!record.userId) {
      throw new BadRequestException('Invalid verification request');
    }

    // Mark user as verified and activate account.
    await this.authRepository.verifyUserEmailAndActivate(record.userId);

    return { verified: true, message: 'Email verified successfully' };
  }

  private async resolveTenantForEmailVerification(email: string, tenantDomain?: string) {
    const fromDto = tenantDomain?.trim();
    if (fromDto) {
      const tenant = await this.authRepository.findTenantByDomain(fromDto.toLowerCase());
      return tenant ?? null;
    }

    // Fallback: infer tenant from email.
    // This is safe in this codebase because registration enforces global email uniqueness.
    const user = await this.authRepository.findUserByEmailGlobally(email);
    if (!user?.tenantId) return null;

    const tenant = await this.authRepository.findTenantById(user.tenantId);
    return tenant ?? null;
  }

  // ========================
  // FORGOT PASSWORD (EMAIL + OTP)
  // ========================

  async requestForgotPassword(dto: ForgotPasswordRequestDto) {
    const generic = {
      message: 'If an account exists for that email, a verification code has been sent.',
    };

    const email = dto.email.trim();

    if (process.env.NODE_ENV !== 'production') {
      this.logger.debug(`Forgot-password request received (email=${maskEmailForLogs(email)})`);
    }

    // Find active user by email across all tenants
    const user = await this.authRepository.findActiveUserByEmailGlobally(email);
    if (!user) {
      if (process.env.NODE_ENV !== 'production') {
        this.logger.debug(
          `Forgot-password skipped: user not found (email=${maskEmailForLogs(email)})`
        );
      }
      return generic;
    }

    // Check if user has a password set
    if (!user.hashedPassword) {
      if (process.env.NODE_ENV !== 'production') {
        this.logger.debug(`Forgot-password skipped: user has no password set (userId=${user.id})`);
      }
      return generic;
    }

    const tenant = user.tenant;

    // Optional tenant status check (skip system).
    if (tenant.domain !== 'system' && tenant.status !== 'ACTIVE') {
      if (process.env.NODE_ENV !== 'production') {
        this.logger.debug(
          `Forgot-password skipped: tenant not ACTIVE (tenantId=${tenant.id}, status=${tenant.status})`
        );
      }
      return generic;
    }

    // Rate limit by email+tenant: minimum 60s between sends.
    const latest = await this.authRepository.findLatestPasswordResetOtp(tenant.id, email);
    if (latest?.createdAt) {
      const elapsedMs = Date.now() - new Date(latest.createdAt).getTime();
      if (elapsedMs < 60_000) {
        if (process.env.NODE_ENV !== 'production') {
          this.logger.debug(
            `Forgot-password skipped: resend window (tenantId=${tenant.id}, email=${maskEmailForLogs(email)}, elapsedMs=${elapsedMs})`
          );
        }
        return generic;
      }
    }

    const otp = generateNumericOtp(6);
    const salt = generateOtpSalt();
    const pepper = this.getPasswordResetOtpPepper();
    const otpHash = hashOtp(otp, salt, pepper);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_OTP_TTL_MINUTES * 60_000);

    // Keep only one active OTP per user (best UX)
    await this.authRepository.deleteActivePasswordResetOtps(tenant.id, email);
    await this.authRepository.createPasswordResetOtp({
      tenantId: tenant.id,
      email,
      userId: user.id,
      otpHash,
      otpSalt: salt,
      expiresAt,
    });

    const templateId = this.configService.get<number>('email.passwordResetOtpTemplateId');
    const appName = this.getAppName();
    const minutes = PASSWORD_RESET_OTP_TTL_MINUTES;
    const logoUrl = this.configService.get<string>('email.logoUrl');

    try {
      if (templateId) {
        if (process.env.NODE_ENV !== 'production') {
          this.logger.debug(
            `Forgot-password sending via Brevo template (templateId=${templateId}, to=${maskEmailForLogs(email)})`
          );
        }
        await this.emailService.sendTransactionalTemplateEmail({
          to: { email, name: `${user.firstName} ${user.lastName}`.trim() || undefined },
          templateId,
          params: {
            appName,
            code: otp,
            minutes,
            tenantName: tenant.name,
            logoUrl,
          },
        });
      } else {
        if (process.env.NODE_ENV !== 'production') {
          this.logger.debug(
            `Forgot-password sending via fallback HTML (to=${maskEmailForLogs(email)})`
          );
        }
        await this.emailService.sendTransactionalEmail({
          to: { email, name: `${user.firstName} ${user.lastName}`.trim() || undefined },
          subject: `${appName} — Password reset code`,
          htmlContent: `
            <div style="font-family: Arial, sans-serif; line-height: 1.5;">
              <h2>${appName}</h2>
              <p>Hello${user.firstName ? ` ${user.firstName}` : ''},</p>
              <p>Use the following verification code to reset your password:</p>
              <p style="font-size: 24px; font-weight: bold; letter-spacing: 2px;">${otp}</p>
              <p>This code expires in <b>${minutes} minutes</b>.</p>
              <p>If you didn’t request this, you can safely ignore this email.</p>
            </div>
          `,
          textContent: `${appName} password reset code: ${otp}. Expires in ${minutes} minutes.`,
        });
      }

      if (process.env.NODE_ENV !== 'production') {
        this.logger.debug(
          `Forgot-password email send attempt completed (to=${maskEmailForLogs(email)})`
        );
      }

      // Notify platform admin about password reset request
      if (user.roles.some((ur) => ur.role.name === ROLES.PLATFORM_ADMIN)) {
        try {
          await this.notificationService.notifyPasswordResetRequested(user.tenantId, user.id);
        } catch (notificationError) {
          this.logger.error(`Failed to send password reset notification: ${notificationError}`);
          // Don't fail the password reset flow
        }
      }
    } catch (err: unknown) {
      // Do not leak send failures to callers; still return generic response.
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Forgot-password OTP email send failed: ${message}`);
      return generic;
    }

    return generic;
  }

  async verifyForgotPasswordOtp(dto: ForgotPasswordVerifyDto) {
    const email = dto.email.trim();
    const otp = dto.otp.trim();

    const record = await this.authRepository.findLatestPasswordResetOtpGlobally(email);
    if (!record || record.usedAt) throw new InvalidPasswordResetOtpException();

    const now = new Date();
    if (record.lockedUntil && record.lockedUntil > now) {
      throw new PasswordResetOtpLockedException();
    }

    if (record.expiresAt <= now) {
      throw new InvalidPasswordResetOtpException();
    }

    const pepper = this.getPasswordResetOtpPepper();
    const expected = hashOtp(otp, record.otpSalt, pepper);

    if (expected !== record.otpHash) {
      const nextAttempts = (record.attempts ?? 0) + 1;
      let lockedUntil: Date | null = null;
      if (nextAttempts >= 5) {
        lockedUntil = new Date(Date.now() + 15 * 60_000);
      }

      await this.authRepository.updatePasswordResetOtpAttempts(record.id, {
        attempts: nextAttempts,
        lockedUntil,
      });

      if (lockedUntil) {
        throw new PasswordResetOtpLockedException();
      }

      throw new InvalidPasswordResetOtpException();
    }

    await this.authRepository.markPasswordResetOtpUsed(record.id);

    if (!record.userId) {
      throw new InvalidPasswordResetOtpException();
    }

    const resetPayload: PasswordResetTokenPayload = {
      purpose: 'password-reset',
      sub: record.userId,
      email,
      tenantId: record.tenantId,
      otpId: record.id,
    };

    const resetToken = this.jwtService.sign(resetPayload, { expiresIn: '10m' });
    return { resetToken };
  }

  async resetForgottenPassword(dto: ForgotPasswordResetDto) {
    let payload: PasswordResetTokenPayload;
    try {
      payload = this.jwtService.verify(dto.resetToken) as PasswordResetTokenPayload;
    } catch {
      throw new InvalidPasswordResetTokenException();
    }

    if (!payload || payload.purpose !== 'password-reset' || !payload.sub || !payload.tenantId) {
      throw new InvalidPasswordResetTokenException();
    }

    const user = await this.authRepository.findUserById(payload.sub);
    if (!user) throw new InvalidPasswordResetTokenException();

    if (user.tenantId !== payload.tenantId) throw new InvalidPasswordResetTokenException();
    if (user.email !== payload.email) throw new InvalidPasswordResetTokenException();

    const minLen = this.configService.getOrThrow<number>('auth.passwordMinLength');
    if (!dto.newPassword || dto.newPassword.length < minLen) {
      throw new BadRequestException(`Password must be at least ${minLen} characters`);
    }

    const rounds = this.configService.getOrThrow<number>('auth.bcryptRounds');
    const hashedPassword = await bcrypt.hash(dto.newPassword, rounds);
    await this.authRepository.updateUserPassword(user.id, hashedPassword);

    // Notify platform admin about password reset success
    if (user.roles.some((ur) => ur.role.name === ROLES.PLATFORM_ADMIN)) {
      try {
        await this.notificationService.notifyPasswordResetSuccess(user.tenantId, user.id);
      } catch (notificationError) {
        this.logger.error(
          `Failed to send password reset success notification: ${notificationError}`
        );
        // Don't fail the password reset flow
      }
    }

    return { message: 'Password reset successfully' };
  }

  async resendForgotPasswordOtp(dto: ForgotPasswordRequestDto) {
    const email = dto.email.trim();

    if (process.env.NODE_ENV !== 'production') {
      this.logger.debug(
        `Forgot-password resend request received (email=${maskEmailForLogs(email)})`
      );
    }

    // Find active user by email across all tenants
    const user = await this.authRepository.findActiveUserByEmailGlobally(email);
    if (!user) {
      throw new NoActivePasswordResetException();
    }

    const tenant = user.tenant;

    // Check for active (unexpired, unused) OTP
    const latest = await this.authRepository.findLatestPasswordResetOtp(tenant.id, email);
    if (!latest || latest.usedAt || latest.expiresAt <= new Date()) {
      throw new NoActivePasswordResetException();
    }

    // Rate limit: minimum 60s between sends (same as request)
    const elapsedMs = Date.now() - new Date(latest.createdAt).getTime();
    if (elapsedMs < 60_000) {
      if (process.env.NODE_ENV !== 'production') {
        this.logger.debug(
          `Forgot-password resend skipped: resend window (tenantId=${tenant.id}, email=${maskEmailForLogs(email)}, elapsedMs=${elapsedMs})`
        );
      }
      throw new NoActivePasswordResetException();
    }

    const otp = generateNumericOtp(6);
    const salt = generateOtpSalt();
    const pepper = this.getPasswordResetOtpPepper();
    const otpHash = hashOtp(otp, salt, pepper);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_OTP_TTL_MINUTES * 60_000);

    // Update the existing OTP record with new values
    await this.authRepository.updatePasswordResetOtp(latest.id, {
      otpHash,
      otpSalt: salt,
      expiresAt,
      attempts: 0, // Reset attempts
      lockedUntil: null,
    });

    const templateId = this.configService.get<number>('email.passwordResetOtpTemplateId');
    const appName = this.getAppName();
    const minutes = PASSWORD_RESET_OTP_TTL_MINUTES;
    const logoUrl = this.configService.get<string>('email.logoUrl');

    try {
      if (templateId) {
        if (process.env.NODE_ENV !== 'production') {
          this.logger.debug(
            `Forgot-password resend sending via Brevo template (templateId=${templateId}, to=${maskEmailForLogs(email)})`
          );
        }
        await this.emailService.sendTransactionalTemplateEmail({
          to: { email, name: `${user.firstName} ${user.lastName}`.trim() || undefined },
          templateId,
          params: {
            appName,
            code: otp,
            minutes,
            tenantName: tenant.name,
            logoUrl,
          },
        });
      } else {
        if (process.env.NODE_ENV !== 'production') {
          this.logger.debug(
            `Forgot-password resend sending via fallback HTML (to=${maskEmailForLogs(email)})`
          );
        }
        await this.emailService.sendTransactionalEmail({
          to: { email, name: `${user.firstName} ${user.lastName}`.trim() || undefined },
          subject: `${appName} — Password reset code (resent)`,
          htmlContent: `
            <div style="font-family: Arial, sans-serif; line-height: 1.5;">
              <h2>${appName}</h2>
              <p>Hello${user.firstName ? ` ${user.firstName}` : ''},</p>
              <p>Use the following verification code to reset your password:</p>
              <p style="font-size: 24px; font-weight: bold; letter-spacing: 2px;">${otp}</p>
              <p>This code expires in <b>${minutes} minutes</b>.</p>
              <p>If you didn’t request this, you can safely ignore this email.</p>
            </div>
          `,
          textContent: `${appName} password reset code: ${otp}. Expires in ${minutes} minutes.`,
        });
      }

      if (process.env.NODE_ENV !== 'production') {
        this.logger.debug(
          `Forgot-password resend email sent (tenantId=${tenant.id}, email=${maskEmailForLogs(email)})`
        );
      }
    } catch (error) {
      this.logger.error(
        `Forgot-password resend email failed (tenantId=${tenant.id}, email=${maskEmailForLogs(email)})`,
        error
      );
      throw error;
    }

    return { message: 'Verification code resent successfully' };
  }
}
