import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuthRepository {
  constructor(private prisma: PrismaService) {}

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

  async updateUserLastLogin(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
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
}