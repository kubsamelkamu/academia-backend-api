import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EvaluationStage } from '@prisma/client';
import { EvaluationStageQueryDto, UpdateDepartmentStageEvaluationWeightDto } from './dto';
import { CoordinatorEvaluationWeightRepository } from './coordinator-evaluation-weight.repository';

@Injectable()
export class CoordinatorEvaluationWeightService {
  constructor(private readonly repository: CoordinatorEvaluationWeightRepository) {}

  private ensureSupportedStage(stage: EvaluationStage) {
    if (![EvaluationStage.CAPSTONE_I, EvaluationStage.CAPSTONE_II].includes(stage)) {
      throw new BadRequestException('Only CAPSTONE_I and CAPSTONE_II are supported for now');
    }
  }

  private fullName(person: { firstName: string; lastName: string }) {
    return `${String(person.firstName ?? '').trim()} ${String(person.lastName ?? '').trim()}`.trim();
  }

  private async resolveCoordinatorContext(user: any) {
    if (!user?.sub) {
      throw new ForbiddenException('Missing user context');
    }

    const actor = await this.repository.findUserDepartmentContext(user.sub);
    if (!actor) {
      throw new NotFoundException('Coordinator user not found');
    }

    if (!actor.departmentId) {
      throw new ForbiddenException('Coordinator is not assigned to a department');
    }

    return {
      ...actor,
      departmentId: actor.departmentId,
    };
  }

  async getWeights(user: any, query: EvaluationStageQueryDto) {
    this.ensureSupportedStage(query.stage);

    const actor = await this.resolveCoordinatorContext(user);
    const weight = await this.repository.findDepartmentStageWeight(actor.departmentId, query.stage);

    return {
      stage: query.stage,
      departmentId: actor.departmentId,
      isConfigured: Boolean(weight),
      advisorPercentage: weight?.advisorPercentage ?? null,
      evaluatorPercentage: weight?.evaluatorPercentage ?? null,
      updatedAt: weight?.updatedAt ?? null,
      updatedBy: weight?.updatedBy
        ? {
            userId: weight.updatedBy.id,
            fullName: this.fullName(weight.updatedBy),
          }
        : null,
    };
  }

  async updateWeights(user: any, dto: UpdateDepartmentStageEvaluationWeightDto) {
    this.ensureSupportedStage(dto.stage);

    if (dto.advisorPercentage + dto.evaluatorPercentage !== 100) {
      throw new BadRequestException(
        'Advisor and evaluator percentages must both be greater than 0, less than 100, and sum to 100'
      );
    }

    const actor = await this.resolveCoordinatorContext(user);
    const saved = await this.repository.upsertDepartmentStageWeight({
      tenantId: actor.tenantId,
      departmentId: actor.departmentId,
      stage: dto.stage,
      advisorPercentage: dto.advisorPercentage,
      evaluatorPercentage: dto.evaluatorPercentage,
      updatedByUserId: actor.id,
    });

    return {
      stage: saved.stage,
      departmentId: saved.departmentId,
      advisorPercentage: saved.advisorPercentage,
      evaluatorPercentage: saved.evaluatorPercentage,
      updatedAt: saved.updatedAt,
      updatedBy: saved.updatedBy
        ? {
            userId: saved.updatedBy.id,
            fullName: this.fullName(saved.updatedBy),
          }
        : null,
    };
  }
}