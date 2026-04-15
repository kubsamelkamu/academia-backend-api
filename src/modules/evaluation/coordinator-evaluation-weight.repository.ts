import { EvaluationStage } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CoordinatorEvaluationWeightRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUserDepartmentContext(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        tenantId: true,
        departmentId: true,
        firstName: true,
        lastName: true,
        email: true,
        status: true,
      },
    });
  }

  async findDepartmentStageWeight(departmentId: string, stage: EvaluationStage) {
    return this.prisma.departmentStageEvaluationWeight.findUnique({
      where: {
        departmentId_stage: {
          departmentId,
          stage,
        },
      },
      select: {
        id: true,
        tenantId: true,
        departmentId: true,
        stage: true,
        advisorPercentage: true,
        evaluatorPercentage: true,
        createdAt: true,
        updatedAt: true,
        updatedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async upsertDepartmentStageWeight(params: {
    tenantId: string;
    departmentId: string;
    stage: EvaluationStage;
    advisorPercentage: number;
    evaluatorPercentage: number;
    updatedByUserId: string;
  }) {
    return this.prisma.departmentStageEvaluationWeight.upsert({
      where: {
        departmentId_stage: {
          departmentId: params.departmentId,
          stage: params.stage,
        },
      },
      update: {
        advisorPercentage: params.advisorPercentage,
        evaluatorPercentage: params.evaluatorPercentage,
        updatedByUserId: params.updatedByUserId,
      },
      create: {
        tenantId: params.tenantId,
        departmentId: params.departmentId,
        stage: params.stage,
        advisorPercentage: params.advisorPercentage,
        evaluatorPercentage: params.evaluatorPercentage,
        updatedByUserId: params.updatedByUserId,
      },
      select: {
        id: true,
        tenantId: true,
        departmentId: true,
        stage: true,
        advisorPercentage: true,
        evaluatorPercentage: true,
        createdAt: true,
        updatedAt: true,
        updatedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }
}