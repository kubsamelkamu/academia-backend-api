import { Injectable } from '@nestjs/common';
import { GroupLeaderRequestStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class GroupLeaderRequestRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.groupLeaderRequest.findUnique({
      where: { id },
      select: {
        id: true,
        tenantId: true,
        departmentId: true,
        studentUserId: true,
        applicationMessage: true,
        status: true,
        reviewedByUserId: true,
        reviewedAt: true,
        rejectionReason: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findByStudentUserId(studentUserId: string) {
    return this.prisma.groupLeaderRequest.findUnique({
      where: { studentUserId },
      select: {
        id: true,
        tenantId: true,
        departmentId: true,
        studentUserId: true,
        applicationMessage: true,
        status: true,
        reviewedByUserId: true,
        reviewedAt: true,
        rejectionReason: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async createRequest(params: {
    tenantId: string;
    departmentId: string;
    studentUserId: string;
    message?: string;
  }) {
    return this.prisma.groupLeaderRequest.create({
      data: {
        tenantId: params.tenantId,
        departmentId: params.departmentId,
        studentUserId: params.studentUserId,
        applicationMessage: params.message ?? null,
        status: GroupLeaderRequestStatus.PENDING,
      },
      select: {
        id: true,
        tenantId: true,
        departmentId: true,
        studentUserId: true,
        applicationMessage: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async listPendingByDepartmentPaged(params: {
    tenantId: string;
    departmentId: string;
    skip: number;
    take: number;
    search?: string;
  }) {
    const search = params.search?.trim();

    const where: Prisma.GroupLeaderRequestWhereInput = {
      tenantId: params.tenantId,
      departmentId: params.departmentId,
      status: GroupLeaderRequestStatus.PENDING,
      ...(search
        ? {
            studentUser: {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.groupLeaderRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.take,
        select: {
          id: true,
          tenantId: true,
          departmentId: true,
          studentUserId: true,
          applicationMessage: true,
          status: true,
          createdAt: true,
          studentUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatarUrl: true,
              tenantId: true,
              departmentId: true,
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
          },
        },
      }),
      this.prisma.groupLeaderRequest.count({ where }),
    ]);

    return { items, total };
  }

  async getDepartmentStatusSummary(params: { tenantId: string; departmentId: string }) {
    const grouped = await this.prisma.groupLeaderRequest.groupBy({
      by: ['status'],
      where: {
        tenantId: params.tenantId,
        departmentId: params.departmentId,
      },
      _count: {
        _all: true,
      },
    });

    const summary = {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
    };

    for (const row of grouped) {
      const count = Number(row._count._all ?? 0);
      summary.total += count;

      if (row.status === GroupLeaderRequestStatus.PENDING) {
        summary.pending += count;
      }

      if (row.status === GroupLeaderRequestStatus.APPROVED) {
        summary.approved += count;
      }

      if (row.status === GroupLeaderRequestStatus.REJECTED) {
        summary.rejected += count;
      }
    }

    return summary;
  }

  async approveRequest(params: { id: string; reviewerUserId: string }) {
    return this.prisma.groupLeaderRequest.update({
      where: { id: params.id },
      data: {
        status: GroupLeaderRequestStatus.APPROVED,
        reviewedByUserId: params.reviewerUserId,
        reviewedAt: new Date(),
        rejectionReason: null,
      },
      select: {
        id: true,
        tenantId: true,
        departmentId: true,
        studentUserId: true,
        status: true,
        reviewedByUserId: true,
        reviewedAt: true,
        rejectionReason: true,
        updatedAt: true,
      },
    });
  }

  async rejectRequest(params: { id: string; reviewerUserId: string; reason?: string }) {
    return this.prisma.groupLeaderRequest.update({
      where: { id: params.id },
      data: {
        status: GroupLeaderRequestStatus.REJECTED,
        reviewedByUserId: params.reviewerUserId,
        reviewedAt: new Date(),
        rejectionReason: params.reason ?? null,
      },
      select: {
        id: true,
        tenantId: true,
        departmentId: true,
        studentUserId: true,
        status: true,
        reviewedByUserId: true,
        reviewedAt: true,
        rejectionReason: true,
        updatedAt: true,
      },
    });
  }
}
