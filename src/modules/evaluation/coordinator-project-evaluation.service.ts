import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EvaluationStage, ProjectStageFinalResultStatus, UserStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { EvaluationStageQueryDto } from './dto';
import { CoordinatorEvaluationWeightRepository } from './coordinator-evaluation-weight.repository';
import { CoordinatorProjectEvaluationRepository } from './coordinator-project-evaluation.repository';

type AggregationStatus =
  | 'WAITING_FOR_WEIGHTS'
  | 'WAITING_FOR_ADVISOR'
  | 'WAITING_FOR_EVALUATORS'
  | 'READY_FOR_AGGREGATION';

type FinalizationStatus =
  | 'NOT_FINALIZED'
  | 'FINALIZED_PENDING_DEPARTMENT_HEAD'
  | 'APPROVED'
  | 'REJECTED';

type NextAction =
  | 'CONFIGURE_WEIGHTS'
  | 'WAIT_FOR_ADVISOR_SUBMISSION'
  | 'WAIT_FOR_EVALUATOR_SUBMISSIONS'
  | 'OPEN_PREVIEW'
  | 'VIEW_FINALIZED_RESULT'
  | 'VIEW_APPROVED_RESULT'
  | 'REVIEW_REJECTED_RESULT';

const GRADE_SCALE = {
  'A+': { min: 90, max: 100 },
  A: { min: 85, max: 89.99 },
  'A-': { min: 80, max: 84.99 },
  'B+': { min: 75, max: 79.99 },
  B: { min: 70, max: 74.99 },
  'B-': { min: 65, max: 69.99 },
  'C+': { min: 60, max: 64.99 },
  C: { min: 50, max: 59.99 },
  'C-': { min: 45, max: 49.99 },
  D: { min: 40, max: 44.99 },
  F: { min: 0, max: 39.99 },
} as const;

export class FinalizeCoordinatorProjectEvaluationDto {
  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

@Injectable()
export class CoordinatorProjectEvaluationService {
  constructor(
    private readonly weightRepository: CoordinatorEvaluationWeightRepository,
    private readonly repository: CoordinatorProjectEvaluationRepository
  ) {}

  private ensureSupportedStage(stage: EvaluationStage) {
    if (stage !== EvaluationStage.CAPSTONE_I) {
      throw new BadRequestException('Only CAPSTONE_I is supported for now');
    }
  }

  private fullName(person: { firstName: string; lastName: string }) {
    return `${String(person.firstName ?? '').trim()} ${String(person.lastName ?? '').trim()}`.trim();
  }

  private async resolveCoordinatorContext(user: any) {
    if (!user?.sub) {
      throw new ForbiddenException('Missing user context');
    }

    const actor = await this.weightRepository.findUserDepartmentContext(user.sub);
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

  private normalizeStudents(group: {
    leader: any;
    members: Array<{ user: any }>;
  }) {
    const map = new Map<string, any>();
    const candidates = [group.leader, ...group.members.map((member) => member.user)];

    for (const student of candidates) {
      if (!student?.id) {
        continue;
      }

      map.set(student.id, student);
    }

    return Array.from(map.values()).filter(
      (student) => student.status === UserStatus.ACTIVE || student.status === UserStatus.PENDING
    );
  }

  private calculateEvaluatorAverage(scores: number[]) {
    if (!scores.length) {
      return null;
    }

    return Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(2));
  }

  private toLetterGrade(finalGrade: number) {
    if (finalGrade >= 90) return 'A+';
    if (finalGrade >= 85) return 'A';
    if (finalGrade >= 80) return 'A-';
    if (finalGrade >= 75) return 'B+';
    if (finalGrade >= 70) return 'B';
    if (finalGrade >= 65) return 'B-';
    if (finalGrade >= 60) return 'C+';
    if (finalGrade >= 50) return 'C';
    if (finalGrade >= 45) return 'C-';
    if (finalGrade >= 40) return 'D';
    return 'F';
  }

  private async buildProjectDetailState(user: any, query: EvaluationStageQueryDto, projectId: string) {
    this.ensureSupportedStage(query.stage);

    const actor = await this.resolveCoordinatorContext(user);
    const weight = await this.weightRepository.findDepartmentStageWeight(actor.departmentId, query.stage);
    const project = await this.repository.findDepartmentProjectDetail({
      departmentId: actor.departmentId,
      projectId,
      stage: query.stage,
    });

    if (!project) {
      throw new NotFoundException('Project not found for this coordinator');
    }

    const group = project.proposal?.projectGroup;
    if (!group) {
      throw new BadRequestException('Project group not found for this project');
    }

    const students = this.normalizeStudents(group);
    const advisorEvaluation = project.advisorEvaluations[0] ?? null;
    const assignedEvaluators = project.evaluators;
    const evaluatorEvaluationByUserId = new Map(
      project.evaluatorEvaluations.map((evaluation) => [evaluation.evaluatorUserId, evaluation])
    );
    const finalResult = project.stageFinalResults[0] ?? null;

    const submittedEvaluators = assignedEvaluators.filter((assigned) => {
      const evaluation = evaluatorEvaluationByUserId.get(assigned.evaluatorUserId);
      return evaluation?.status === 'SUBMITTED';
    });

    let aggregationStatus: AggregationStatus;
    if (!weight) {
      aggregationStatus = 'WAITING_FOR_WEIGHTS';
    } else if (!advisorEvaluation || advisorEvaluation.status !== 'SUBMITTED') {
      aggregationStatus = 'WAITING_FOR_ADVISOR';
    } else if (
      assignedEvaluators.length === 0 ||
      submittedEvaluators.length < assignedEvaluators.length
    ) {
      aggregationStatus = 'WAITING_FOR_EVALUATORS';
    } else {
      aggregationStatus = 'READY_FOR_AGGREGATION';
    }

    const finalizationStatus = (finalResult?.status ?? 'NOT_FINALIZED') as FinalizationStatus;
    const studentsWithScores = students.map((student) => {
      const advisorScore = advisorEvaluation?.scores.find((item) => item.studentUserId === student.id) ?? null;
      const evaluatorScores = assignedEvaluators.map((assigned) => {
        const evaluation = evaluatorEvaluationByUserId.get(assigned.evaluatorUserId);
        const score = evaluation?.scores.find((item) => item.studentUserId === student.id) ?? null;

        return {
          evaluatorUserId: assigned.evaluator.id,
          evaluatorName: this.fullName(assigned.evaluator),
          score: score?.score ?? null,
          comment: score?.comment ?? null,
          status: score ? 'EVALUATED' : 'PENDING',
        };
      });

      const allEvaluatorScoresPresent =
        evaluatorScores.length > 0 && evaluatorScores.every((item) => item.score !== null);
      const evaluatorAverageScore = allEvaluatorScoresPresent
        ? this.calculateEvaluatorAverage(evaluatorScores.map((item) => Number(item.score)))
        : null;

      return {
        studentUserId: student.id,
        fullName: this.fullName(student),
        email: student.email,
        advisorScore: {
          score: advisorScore?.score ?? null,
          comment: advisorScore?.comment ?? null,
          status: advisorScore ? 'EVALUATED' : 'PENDING',
        },
        evaluatorScores,
        evaluatorAverageScore,
        isReadyForFinalCalculation: Boolean(advisorScore) && allEvaluatorScoresPresent,
      };
    });

    const readyForPreview =
      aggregationStatus === 'READY_FOR_AGGREGATION' &&
      finalizationStatus !== ProjectStageFinalResultStatus.FINALIZED_PENDING_DEPARTMENT_HEAD &&
      finalizationStatus !== ProjectStageFinalResultStatus.APPROVED;

    return {
      stage: query.stage,
      project,
      group,
      weight,
      advisorEvaluation,
      assignedEvaluators,
      submittedEvaluators,
      finalizationStatus,
      aggregationStatus,
      readyForPreview,
      students: studentsWithScores,
    };
  }

  async getDashboard(user: any, query: EvaluationStageQueryDto) {
    this.ensureSupportedStage(query.stage);

    const actor = await this.resolveCoordinatorContext(user);
    const weight = await this.weightRepository.findDepartmentStageWeight(actor.departmentId, query.stage);
    const projects = await this.repository.listDepartmentProjectsForDashboard({
      departmentId: actor.departmentId,
      stage: query.stage,
    });

    const summary = {
      totalProjectGroups: projects.length,
      waitingForWeightsCount: 0,
      waitingForAdvisorCount: 0,
      waitingForEvaluatorsCount: 0,
      readyForAggregationCount: 0,
      finalizedPendingApprovalCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
    };

    const projectGroups = projects.map((project) => {
      const group = project.proposal?.projectGroup;
      const students = group ? this.normalizeStudents(group) : [];
      const advisorEvaluation = project.advisorEvaluations[0] ?? null;
      const finalResult = project.stageFinalResults[0] ?? null;
      const assignedEvaluatorIds = Array.from(new Set(project.evaluators.map((item) => item.evaluatorUserId)));
      const submittedEvaluators = project.evaluatorEvaluations.filter(
        (item) => item.status === 'SUBMITTED' && assignedEvaluatorIds.includes(item.evaluatorUserId)
      );

      let aggregationStatus: AggregationStatus;
      if (!weight) {
        aggregationStatus = 'WAITING_FOR_WEIGHTS';
      } else if (!advisorEvaluation || advisorEvaluation.status !== 'SUBMITTED') {
        aggregationStatus = 'WAITING_FOR_ADVISOR';
      } else if (
        assignedEvaluatorIds.length === 0 ||
        submittedEvaluators.length < assignedEvaluatorIds.length
      ) {
        aggregationStatus = 'WAITING_FOR_EVALUATORS';
      } else {
        aggregationStatus = 'READY_FOR_AGGREGATION';
      }

      const finalizationStatus = (finalResult?.status ?? 'NOT_FINALIZED') as FinalizationStatus;

      let nextAction: NextAction;
      if (finalizationStatus === ProjectStageFinalResultStatus.FINALIZED_PENDING_DEPARTMENT_HEAD) {
        nextAction = 'VIEW_FINALIZED_RESULT';
      } else if (finalizationStatus === ProjectStageFinalResultStatus.APPROVED) {
        nextAction = 'VIEW_APPROVED_RESULT';
      } else if (finalizationStatus === ProjectStageFinalResultStatus.REJECTED) {
        nextAction = 'REVIEW_REJECTED_RESULT';
      } else if (aggregationStatus === 'WAITING_FOR_WEIGHTS') {
        nextAction = 'CONFIGURE_WEIGHTS';
      } else if (aggregationStatus === 'WAITING_FOR_ADVISOR') {
        nextAction = 'WAIT_FOR_ADVISOR_SUBMISSION';
      } else if (aggregationStatus === 'WAITING_FOR_EVALUATORS') {
        nextAction = 'WAIT_FOR_EVALUATOR_SUBMISSIONS';
      } else {
        nextAction = 'OPEN_PREVIEW';
      }

      if (aggregationStatus === 'WAITING_FOR_WEIGHTS') summary.waitingForWeightsCount += 1;
      if (aggregationStatus === 'WAITING_FOR_ADVISOR') summary.waitingForAdvisorCount += 1;
      if (aggregationStatus === 'WAITING_FOR_EVALUATORS') summary.waitingForEvaluatorsCount += 1;
      if (aggregationStatus === 'READY_FOR_AGGREGATION' && finalizationStatus === 'NOT_FINALIZED') {
        summary.readyForAggregationCount += 1;
      }
      if (finalizationStatus === ProjectStageFinalResultStatus.FINALIZED_PENDING_DEPARTMENT_HEAD) {
        summary.finalizedPendingApprovalCount += 1;
      }
      if (finalizationStatus === ProjectStageFinalResultStatus.APPROVED) {
        summary.approvedCount += 1;
      }
      if (finalizationStatus === ProjectStageFinalResultStatus.REJECTED) {
        summary.rejectedCount += 1;
      }

      return {
        projectId: project.id,
        projectTitle: project.title,
        projectStatus: project.status,
        group: group
          ? {
              id: group.id,
              name: group.name,
              totalMembers: students.length,
            }
          : null,
        advisorEvaluation: {
          status: advisorEvaluation?.status ?? 'NOT_STARTED',
          submittedAt: advisorEvaluation?.submittedAt ?? null,
        },
        evaluatorEvaluation: {
          totalAssignedEvaluators: assignedEvaluatorIds.length,
          submittedEvaluators: submittedEvaluators.length,
          pendingEvaluators: Math.max(assignedEvaluatorIds.length - submittedEvaluators.length, 0),
          allSubmitted:
            assignedEvaluatorIds.length > 0 && submittedEvaluators.length === assignedEvaluatorIds.length,
        },
        aggregationStatus,
        finalizationStatus,
        weights: {
          advisorPercentage: finalResult?.advisorPercentage ?? weight?.advisorPercentage ?? null,
          evaluatorPercentage: finalResult?.evaluatorPercentage ?? weight?.evaluatorPercentage ?? null,
        },
        finalizedBy: finalResult?.finalizedBy
          ? {
              userId: finalResult.finalizedBy.id,
              fullName: this.fullName(finalResult.finalizedBy),
            }
          : null,
        finalizedAt: finalResult?.finalizedAt ?? null,
        approvedAt: finalResult?.approvedAt ?? null,
        hasRejectionReason: Boolean(finalResult?.rejectionReason),
        nextAction,
      };
    });

    return {
      stage: query.stage,
      weights: {
        isConfigured: Boolean(weight),
        advisorPercentage: weight?.advisorPercentage ?? null,
        evaluatorPercentage: weight?.evaluatorPercentage ?? null,
        updatedAt: weight?.updatedAt ?? null,
      },
      summary,
      projectGroups,
    };
  }

  async getProjectDetail(user: any, projectId: string, query: EvaluationStageQueryDto) {
    const state = await this.buildProjectDetailState(user, query, projectId);

    return {
      stage: state.stage,
      project: {
        id: state.project.id,
        title: state.project.title,
        status: state.project.status,
        createdAt: state.project.createdAt,
      },
      group: {
        id: state.group.id,
        name: state.group.name,
        status: state.group.status,
        totalMembers: state.students.length,
        leader: {
          userId: state.group.leader.id,
          fullName: this.fullName(state.group.leader),
          email: state.group.leader.email,
        },
      },
      weights: {
        isConfigured: Boolean(state.weight),
        advisorPercentage: state.weight?.advisorPercentage ?? null,
        evaluatorPercentage: state.weight?.evaluatorPercentage ?? null,
        updatedAt: state.weight?.updatedAt ?? null,
      },
      advisorEvaluation: {
        status: state.advisorEvaluation?.status ?? 'NOT_STARTED',
        submittedAt: state.advisorEvaluation?.submittedAt ?? null,
        studentsEvaluated: state.advisorEvaluation?.scores.length ?? 0,
        studentsPendingEvaluation: Math.max(state.students.length - (state.advisorEvaluation?.scores.length ?? 0), 0),
      },
      evaluatorEvaluation: {
        totalAssignedEvaluators: state.assignedEvaluators.length,
        submittedEvaluators: state.submittedEvaluators.length,
        pendingEvaluators: Math.max(state.assignedEvaluators.length - state.submittedEvaluators.length, 0),
        allSubmitted:
          state.assignedEvaluators.length > 0 &&
          state.submittedEvaluators.length === state.assignedEvaluators.length,
        evaluators: state.assignedEvaluators.map((assigned) => {
          const evaluation = state.project.evaluatorEvaluations.find(
            (item) => item.evaluatorUserId === assigned.evaluatorUserId
          );

          return {
            evaluatorUserId: assigned.evaluator.id,
            fullName: this.fullName(assigned.evaluator),
            status: evaluation?.status ?? 'NOT_STARTED',
            submittedAt: evaluation?.submittedAt ?? null,
          };
        }),
      },
      students: state.students,
      aggregationStatus: state.aggregationStatus,
      finalizationStatus: state.finalizationStatus,
      readyForPreview: state.readyForPreview,
    };
  }

  async previewProject(user: any, projectId: string, query: EvaluationStageQueryDto) {
    const state = await this.buildProjectDetailState(user, query, projectId);

    if (!state.weight) {
      throw new BadRequestException(`Grading weights are not configured for ${query.stage} in this department`);
    }

    if (!state.advisorEvaluation || state.advisorEvaluation.status !== 'SUBMITTED') {
      throw new BadRequestException('Advisor evaluation must be submitted before previewing final grades');
    }

    if (
      state.assignedEvaluators.length === 0 ||
      state.submittedEvaluators.length < state.assignedEvaluators.length
    ) {
      throw new BadRequestException(
        'All assigned evaluator evaluations must be submitted before previewing final grades'
      );
    }

    if (state.finalizationStatus === ProjectStageFinalResultStatus.FINALIZED_PENDING_DEPARTMENT_HEAD) {
      throw new BadRequestException('Final grade has already been finalized for this project and stage');
    }

    if (state.finalizationStatus === ProjectStageFinalResultStatus.APPROVED) {
      throw new BadRequestException('Final grade has already been approved and cannot be previewed again');
    }

    const missingStudents = state.students.filter((student) => !student.isReadyForFinalCalculation);
    if (missingStudents.length > 0) {
      throw new BadRequestException('Some students are missing required scores for final preview');
    }

    const weight = state.weight;

    return {
      stage: state.stage,
      project: {
        id: state.project.id,
        title: state.project.title,
        status: state.project.status,
      },
      group: {
        id: state.group.id,
        name: state.group.name,
        totalMembers: state.students.length,
      },
      weights: {
        advisorPercentage: weight.advisorPercentage,
        evaluatorPercentage: weight.evaluatorPercentage,
      },
      students: state.students.map((student) => {
        const finalGrade = Number(
          (
            (Number(student.advisorScore.score) * weight.advisorPercentage) / 100 +
            (Number(student.evaluatorAverageScore) * weight.evaluatorPercentage) / 100
          ).toFixed(2)
        );

        return {
          studentUserId: student.studentUserId,
          fullName: student.fullName,
          email: student.email,
          advisorScore: {
            score: student.advisorScore.score,
            comment: student.advisorScore.comment,
          },
          evaluatorScores: student.evaluatorScores.map((score) => ({
            evaluatorUserId: score.evaluatorUserId,
            evaluatorName: score.evaluatorName,
            score: score.score,
            comment: score.comment,
          })),
          evaluatorAverageScore: student.evaluatorAverageScore,
          finalGrade,
          letterGrade: this.toLetterGrade(finalGrade),
        };
      }),
      roundedToDecimalPlaces: 2,
      gradeScale: GRADE_SCALE,
      aggregationStatus: state.aggregationStatus,
      readyToFinalize: true,
      previewGeneratedAt: new Date().toISOString(),
    };
  }

  async finalizeProject(
    user: any,
    projectId: string,
    query: EvaluationStageQueryDto,
    body: FinalizeCoordinatorProjectEvaluationDto
  ) {
    const state = await this.buildProjectDetailState(user, query, projectId);

    if (!state.weight) {
      throw new BadRequestException(`Grading weights are not configured for ${query.stage} in this department`);
    }

    if (!state.advisorEvaluation || state.advisorEvaluation.status !== 'SUBMITTED') {
      throw new BadRequestException('Advisor evaluation must be submitted before finalization');
    }

    if (
      state.assignedEvaluators.length === 0 ||
      state.submittedEvaluators.length < state.assignedEvaluators.length
    ) {
      throw new BadRequestException(
        'All assigned evaluator evaluations must be submitted before finalization'
      );
    }

    if (state.finalizationStatus === ProjectStageFinalResultStatus.FINALIZED_PENDING_DEPARTMENT_HEAD) {
      throw new BadRequestException('Final grade has already been finalized for this project and stage');
    }

    if (state.finalizationStatus === ProjectStageFinalResultStatus.APPROVED) {
      throw new BadRequestException('Final grade has already been approved and cannot be re-finalized');
    }

    const missingStudents = state.students.filter((student) => !student.isReadyForFinalCalculation);
    if (missingStudents.length > 0) {
      throw new BadRequestException('Some students are missing required scores for finalization');
    }

    const weight = state.weight;
    const actor = await this.resolveCoordinatorContext(user);
    const finalStudents = state.students.map((student) => {
      const finalGrade = Number(
        (
          (Number(student.advisorScore.score) * weight.advisorPercentage) / 100 +
          (Number(student.evaluatorAverageScore) * weight.evaluatorPercentage) / 100
        ).toFixed(2)
      );

      return {
        studentUserId: student.studentUserId,
        advisorScore: Number(student.advisorScore.score),
        advisorComment: student.advisorScore.comment,
        evaluatorAverageScore: Number(student.evaluatorAverageScore),
        evaluatorScores: student.evaluatorScores.map((score) => ({
          evaluatorUserId: score.evaluatorUserId,
          evaluatorName: score.evaluatorName,
          score: Number(score.score),
          comment: score.comment,
        })),
        finalGrade,
        letterGrade: this.toLetterGrade(finalGrade),
      };
    });

    let saved;
    try {
      saved = await this.repository.upsertProjectStageFinalResult({
        tenantId: actor.tenantId,
        departmentId: actor.departmentId,
        projectId: state.project.id,
        stage: state.stage,
        advisorPercentage: weight.advisorPercentage,
        evaluatorPercentage: weight.evaluatorPercentage,
        finalizedByUserId: actor.id,
        finalizationNote: body.note,
        students: finalStudents,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'FINAL_RESULT_ALREADY_APPROVED') {
        throw new BadRequestException('Final grade has already been approved and cannot be re-finalized');
      }

      throw error;
    }

    return {
      projectId: saved.projectId,
      stage: saved.stage,
      status: saved.status,
      weights: {
        advisorPercentage: saved.advisorPercentage,
        evaluatorPercentage: saved.evaluatorPercentage,
      },
      finalizedBy: {
        userId: saved.finalizedBy.id,
        fullName: this.fullName(saved.finalizedBy),
      },
      finalizedAt: saved.finalizedAt,
      note: saved.finalizationNote ?? null,
      students: saved.scores.map((student) => ({
        studentUserId: student.student.id,
        fullName: this.fullName(student.student),
        finalGrade: student.finalGrade,
        letterGrade: student.letterGrade,
      })),
    };
  }
}