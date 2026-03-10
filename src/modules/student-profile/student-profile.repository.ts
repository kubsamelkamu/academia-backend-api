import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { ROLES } from '../../common/constants/roles.constants';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class StudentProfileRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listStudentUsersPaged(params: {
    tenantId: string;
    skip: number;
    take: number;
    search?: string;
  }) {
    const search = params.search?.trim();

    const where: Prisma.UserWhereInput = {
      tenantId: params.tenantId,
      deletedAt: null,
      roles: {
        some: {
          revokedAt: null,
          role: { name: ROLES.STUDENT },
        },
      },
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
        skip: params.skip,
        take: params.take,
        select: {
          id: true,
          tenantId: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          student: {
            select: {
              bio: true,
              githubUrl: true,
              linkedinUrl: true,
              portfolioUrl: true,
              techStack: true,
              updatedAt: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, total };
  }

  async findByUserId(userId: string) {
    return this.prisma.student.findUnique({
      where: { userId },
      select: {
        id: true,
        tenantId: true,
        userId: true,
        bio: true,
        githubUrl: true,
        linkedinUrl: true,
        portfolioUrl: true,
        techStack: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async upsertByUserId(
    tenantId: string,
    userId: string,
    data: {
      bio?: string | null;
      githubUrl?: string | null;
      linkedinUrl?: string | null;
      portfolioUrl?: string | null;
      techStack?: string[];
    }
  ) {
    return this.prisma.student.upsert({
      where: { userId },
      update: {
        bio: data.bio !== undefined ? data.bio : undefined,
        githubUrl: data.githubUrl !== undefined ? data.githubUrl : undefined,
        linkedinUrl: data.linkedinUrl !== undefined ? data.linkedinUrl : undefined,
        portfolioUrl: data.portfolioUrl !== undefined ? data.portfolioUrl : undefined,
        techStack: data.techStack !== undefined ? data.techStack : undefined,
      },
      create: {
        tenantId,
        userId,
        bio: data.bio !== undefined ? data.bio : null,
        githubUrl: data.githubUrl !== undefined ? data.githubUrl : null,
        linkedinUrl: data.linkedinUrl !== undefined ? data.linkedinUrl : null,
        portfolioUrl: data.portfolioUrl !== undefined ? data.portfolioUrl : null,
        techStack: data.techStack !== undefined ? data.techStack : [],
      },
      select: {
        id: true,
        tenantId: true,
        userId: true,
        bio: true,
        githubUrl: true,
        linkedinUrl: true,
        portfolioUrl: true,
        techStack: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}
