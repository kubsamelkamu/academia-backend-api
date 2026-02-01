import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuthRepository {
  constructor(private prisma: PrismaService) {}

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
}