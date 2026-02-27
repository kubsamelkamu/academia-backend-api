
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuthRepository {
  constructor(private prisma: PrismaService) {}

  async updateUserFirstLoginAndDeadline(userId: string, firstLoginAt: Date, statusUploadDeadline: Date) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        firstLoginAt,
        statusUploadDeadline,
      },
    });
  }

  async updateUserAvatar(
    userId: string,
    data: { avatarUrl: string | null; avatarPublicId: string | null }
  ) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        avatarUrl: data.avatarUrl,
        avatarPublicId: data.avatarPublicId,
      },
      select: {
        id: true,
        avatarUrl: true,
        avatarPublicId: true,
      },
    });
  }

  async updateUserName(userId: string, firstName: string, lastName: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName,
        lastName,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    });
  }

  async replaceUserBackupCodes(userId: string, codeHashes: string[]) {
    return this.prisma.$transaction(async (tx) => {
      await tx.backupCode.deleteMany({ where: { userId } });
      if (codeHashes.length > 0) {
        await tx.backupCode.createMany({
          data: codeHashes.map((codeHash) => ({ userId, codeHash })),
        });
      }

      await tx.user.update({
        where: { id: userId },
        data: { backupCodesResetAt: new Date() },
      });

      return { count: codeHashes.length };
    });
  }

  async getUserBackupCodeHashes(userId: string) {
    return this.prisma.backupCode.findMany({
      where: { userId },
      select: { id: true, codeHash: true, usedAt: true },
    });
  }

  async countUnusedBackupCodes(userId: string): Promise<number> {
    return this.prisma.backupCode.count({
      where: { userId, usedAt: null },
    });
  }

  async markBackupCodeUsed(backupCodeId: string) {
    return this.prisma.backupCode.update({
      where: { id: backupCodeId },
      data: { usedAt: new Date() },
      select: { id: true, usedAt: true },
    });
  }

  async findTenantByDomain(domain: string) {
    return this.prisma.tenant.findUnique({
      where: { domain },
    });
  }

  async findDepartmentById(departmentId: string) {
    return this.prisma.department.findUnique({
      where: { id: departmentId },
      select: { id: true, name: true, code: true },
    });
  }

  async findUserByEmailAndTenant(email: string, tenantId: string) {
    return this.prisma.user.findFirst({
      where: {
        tenantId,
        email,
      },
      include: {
        tenant: true,
        roles: {
          include: { role: true },
        },
      },
    });
  }

  async findActiveUserByEmailGlobally(email: string) {
    return this.prisma.user.findFirst({
      where: {
        email,
        status: 'ACTIVE',
      },
      include: {
        tenant: true,
        roles: {
          include: { role: true },
        },
      },
    });
  }

  async updateUserLastLogin(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }

  async verifyUserEmailAndActivate(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        emailVerified: true,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        emailVerified: true,
        status: true,
      },
    });
  }

  async findUserById(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: { role: true },
        },
        tenant: true,
      },
    });
  }

  async findLatestTenantVerificationRequest(tenantId: string) {
    return this.prisma.tenantVerificationRequest.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        createdAt: true,
        reviewedAt: true,
        reviewReason: true,
      },
    });
  }

  async updateUserPassword(userId: string, hashedPassword: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { hashedPassword },
    });
  }

  async getUserTwoFactor(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        tenantId: true,
        email: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
        twoFactorVerifiedAt: true,
      },
    });
  }

  async setUserTwoFactorSecret(userId: string, secret: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: secret,
        twoFactorEnabled: false,
        twoFactorVerifiedAt: null,
      },
      select: {
        id: true,
        twoFactorEnabled: true,
        twoFactorVerifiedAt: true,
      },
    });
  }

  async enableUserTwoFactor(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
        twoFactorVerifiedAt: new Date(),
      },
      select: {
        id: true,
        twoFactorEnabled: true,
        twoFactorVerifiedAt: true,
      },
    });
  }

  async disableUserTwoFactor(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorVerifiedAt: null,
      },
      select: {
        id: true,
        twoFactorEnabled: true,
        twoFactorVerifiedAt: true,
      },
    });
  }

  async findUserByEmailGlobally(email: string) {
    return this.prisma.user.findFirst({
      where: { email },
      select: { id: true, email: true, tenantId: true },
    });
  }

  async findTenantById(tenantId: string) {
    return this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        domain: true,
        name: true,
        status: true,
      },
    });
  }

  async createInstitutionWithDepartmentHead(data: {
    // Tenant data
    tenantName: string;
    tenantDomain: string;
    // Department data
    departmentName: string;
    departmentCode: string;
    departmentDescription?: string;
    // User data
    email: string;
    firstName: string;
    lastName: string;
    hashedPassword: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Create tenant (institution)
      const tenant = await tx.tenant.create({
        data: {
          name: data.tenantName,
          domain: data.tenantDomain,
          status: 'ACTIVE',
          config: {
            type: 'university',
            onboardingComplete: false,
          },
        },
        select: {
          id: true,
          name: true,
          domain: true,
          status: true,
          config: true,
        },
      });

      // 2. Create department
      const department = await tx.department.create({
        data: {
          name: data.departmentName,
          code: data.departmentCode,
          description: data.departmentDescription,
          tenantId: tenant.id,
        },
        select: {
          id: true,
          name: true,
          code: true,
          description: true,
        },
      });

      // 3. Get DepartmentHead role
      const role = await tx.role.findUnique({
        where: { name: 'DepartmentHead' },
      });

      if (!role) {
        throw new Error('DepartmentHead role not found. Please ensure roles are seeded.');
      }

      // 4. Create department head user
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          departmentId: department.id,
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          hashedPassword: data.hashedPassword,
          status: 'PENDING',
          emailVerified: false,
          roles: {
            create: {
              roleId: role.id,
              tenantId: tenant.id,
              departmentId: department.id,
              assignedBy: data.email, // Self-assigned during registration
            },
          },
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          status: true,
        },
      });

      // Set department head pointer for easier querying.
      await tx.department.update({
        where: { id: department.id },
        data: { headOfDepartmentId: user.id },
        select: { id: true },
      });

      // Persist immutable "original creator" metadata on the tenant.
      // We store both a durable userId reference and a snapshot for display.
      await tx.tenant.update({
        where: { id: tenant.id },
        data: {
          config: {
            ...(tenant.config as any),
            createdByUserId: user.id,
            createdBy: {
              userId: user.id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              role: 'DepartmentHead',
              createdAt: new Date().toISOString(),
            },
          },
        },
        select: { id: true },
      });

      return {
        tenant,
        department,
        user,
      };
    });
  }

  // ========================
  // PASSWORD RESET OTP
  // ========================
  async deleteActivePasswordResetOtps(tenantId: string, email: string) {
    return this.prisma.passwordResetOtp.deleteMany({
      where: {
        tenantId,
        email,
        usedAt: null,
      },
    });
  }

  async createPasswordResetOtp(data: {
    tenantId: string;
    email: string;
    userId: string;
    otpHash: string;
    otpSalt: string;
    expiresAt: Date;
  }) {
    return this.prisma.passwordResetOtp.create({
      data: {
        tenantId: data.tenantId,
        email: data.email,
        userId: data.userId,
        otpHash: data.otpHash,
        otpSalt: data.otpSalt,
        expiresAt: data.expiresAt,
      },
      select: {
        id: true,
        tenantId: true,
        email: true,
        userId: true,
        otpHash: true,
        otpSalt: true,
        expiresAt: true,
        usedAt: true,
        attempts: true,
        lockedUntil: true,
        createdAt: true,
      },
    });
  }

  async findLatestPasswordResetOtp(tenantId: string, email: string) {
    return this.prisma.passwordResetOtp.findFirst({
      where: {
        tenantId,
        email,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        tenantId: true,
        email: true,
        userId: true,
        otpHash: true,
        otpSalt: true,
        expiresAt: true,
        usedAt: true,
        attempts: true,
        lockedUntil: true,
        createdAt: true,
      },
    });
  }

  async findLatestPasswordResetOtpGlobally(email: string) {
    return this.prisma.passwordResetOtp.findFirst({
      where: {
        email,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        tenantId: true,
        email: true,
        userId: true,
        otpHash: true,
        otpSalt: true,
        expiresAt: true,
        usedAt: true,
        attempts: true,
        lockedUntil: true,
        createdAt: true,
      },
    });
  }

  async updatePasswordResetOtpAttempts(
    id: string,
    data: { attempts: number; lockedUntil?: Date | null }
  ) {
    return this.prisma.passwordResetOtp.update({
      where: { id },
      data: {
        attempts: data.attempts,
        lockedUntil: data.lockedUntil ?? null,
      },
      select: {
        id: true,
        attempts: true,
        lockedUntil: true,
      },
    });
  }

  async markPasswordResetOtpUsed(id: string) {
    return this.prisma.passwordResetOtp.update({
      where: { id },
      data: { usedAt: new Date() },
      select: {
        id: true,
        usedAt: true,
      },
    });
  }

  async updatePasswordResetOtp(
    id: string,
    data: {
      otpHash: string;
      otpSalt: string;
      expiresAt: Date;
      attempts: number;
      lockedUntil: Date | null;
    }
  ) {
    return this.prisma.passwordResetOtp.update({
      where: { id },
      data,
      select: {
        id: true,
        otpHash: true,
        otpSalt: true,
        expiresAt: true,
        attempts: true,
        lockedUntil: true,
      },
    });
  }

  // ========================
  // EMAIL VERIFICATION OTP
  // ========================
  async deleteActiveEmailVerificationOtps(tenantId: string, email: string) {
    return this.prisma.emailVerificationOtp.deleteMany({
      where: {
        tenantId,
        email,
        usedAt: null,
      },
    });
  }

  async createEmailVerificationOtp(data: {
    tenantId: string;
    email: string;
    userId: string;
    otpHash: string;
    otpSalt: string;
    expiresAt: Date;
  }) {
    return this.prisma.emailVerificationOtp.create({
      data: {
        tenantId: data.tenantId,
        email: data.email,
        userId: data.userId,
        otpHash: data.otpHash,
        otpSalt: data.otpSalt,
        expiresAt: data.expiresAt,
      },
      select: {
        id: true,
        tenantId: true,
        email: true,
        userId: true,
        otpHash: true,
        otpSalt: true,
        expiresAt: true,
        usedAt: true,
        attempts: true,
        lockedUntil: true,
        createdAt: true,
      },
    });
  }

  async findLatestEmailVerificationOtp(tenantId: string, email: string) {
    return this.prisma.emailVerificationOtp.findFirst({
      where: {
        tenantId,
        email,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        tenantId: true,
        email: true,
        userId: true,
        otpHash: true,
        otpSalt: true,
        expiresAt: true,
        usedAt: true,
        attempts: true,
        lockedUntil: true,
        createdAt: true,
      },
    });
  }

  async updateEmailVerificationOtpAttempts(
    id: string,
    data: { attempts: number; lockedUntil?: Date | null }
  ) {
    return this.prisma.emailVerificationOtp.update({
      where: { id },
      data: {
        attempts: data.attempts,
        lockedUntil: data.lockedUntil ?? null,
      },
      select: {
        id: true,
        attempts: true,
        lockedUntil: true,
      },
    });
  }

  async markEmailVerificationOtpUsed(id: string) {
    return this.prisma.emailVerificationOtp.update({
      where: { id },
      data: { usedAt: new Date() },
      select: {
        id: true,
        usedAt: true,
      },
    });
  }
}
