import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class StudentProfileRepository {
  constructor(private readonly prisma: PrismaService) {}

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
