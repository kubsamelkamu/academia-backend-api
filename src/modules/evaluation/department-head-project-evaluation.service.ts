import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { EvaluationStage, ProjectStageFinalResultStatus, UserStatus } from '@prisma/client';
import { EvaluationStageQueryDto } from './dto';
import { CoordinatorEvaluationWeightRepository } from './coordinator-evaluation-weight.repository';
import { DepartmentHeadProjectEvaluationRepository } from './department-head-project-evaluation.repository';
import { NotificationService } from '../notification/notification.service';

type DepartmentHeadNextAction =
  | 'REVIEW_FINALIZED_RESULT'
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

export class ApproveDepartmentHeadProjectEvaluationDto {
  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class RejectDepartmentHeadProjectEvaluationDto {
  @ApiProperty({ maxLength: 1000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;
}

@Injectable()
export class DepartmentHeadProjectEvaluationService {
  private readonly logger = new Logger(DepartmentHeadProjectEvaluationService.name);

  constructor(
    private readonly weightRepository: CoordinatorEvaluationWeightRepository,
    private readonly repository: DepartmentHeadProjectEvaluationRepository,
    private readonly notificationService: NotificationService
  ) {}

  private ensureSupportedStage(stage: EvaluationStage) {
    if (stage !== EvaluationStage.CAPSTONE_I) {
      throw new BadRequestException('Only CAPSTONE_I is supported for now');
    }
  }

  private fullName(person: { firstName: string; lastName: string }) {
    return `${String(person.firstName ?? '').trim()} ${String(person.lastName ?? '').trim()}`.trim();
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

  private parseEvaluatorScores(value: unknown) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.map((item: any) => ({
      evaluatorUserId: item?.evaluatorUserId ?? null,
      evaluatorName: item?.evaluatorName ?? null,
      score: item?.score ?? null,
      comment: item?.comment ?? null,
    }));
  }

  private extractStudentRecipientUserIds(projectGroup: {
    leader?: { id?: string | null } | null;
    members?: Array<{ user?: { id?: string | null } | null }>;
  } | null) {
    return Array.from(
      new Set(
        [
          projectGroup?.leader?.id,
          ...(projectGroup?.members ?? []).map((member) => member.user?.id),
        ].filter(Boolean)
      )
    ) as string[];
  }

  private async resolveDepartmentHeadContext(user: any) {
    if (!user?.sub) {
      throw new ForbiddenException('Missing user context');
    }

    const actor = await this.weightRepository.findUserDepartmentContext(user.sub);
    if (!actor) {
      throw new NotFoundException('Department head user not found');
    }

    if (!actor.departmentId) {
      throw new ForbiddenException('Department head is not assigned to a department');
    }

    return {
      ...actor,
      departmentId: actor.departmentId,
    };
  }

  async getDashboard(user: any, query: EvaluationStageQueryDto) {
    this.ensureSupportedStage(query.stage);

    const actor = await this.resolveDepartmentHeadContext(user);
    const weight = await this.weightRepository.findDepartmentStageWeight(actor.departmentId, query.stage);
    const finalResults = await this.repository.listDepartmentStageFinalResults({
      departmentId: actor.departmentId,
      stage: query.stage,
    });

    const summary = {
      totalFinalizedProjectGroups: finalResults.length,
      pendingReviewCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
    };

    const projectGroups = finalResults.map((result) => {
      const group = result.project.proposal?.projectGroup;
      const students = group ? this.normalizeStudents(group) : [];

      let nextAction: DepartmentHeadNextAction;
      if (result.status === ProjectStageFinalResultStatus.APPROVED) {
        nextAction = 'VIEW_APPROVED_RESULT';
      } else if (result.status === ProjectStageFinalResultStatus.REJECTED) {
        nextAction = 'REVIEW_REJECTED_RESULT';
      } else {
        nextAction = 'REVIEW_FINALIZED_RESULT';
      }

      if (result.status === ProjectStageFinalResultStatus.FINALIZED_PENDING_DEPARTMENT_HEAD) {
        summary.pendingReviewCount += 1;
      }
      if (result.status === ProjectStageFinalResultStatus.APPROVED) {
        summary.approvedCount += 1;
      }
      if (result.status === ProjectStageFinalResultStatus.REJECTED) {
        summary.rejectedCount += 1;
      }

      return {
        finalResultId: result.id,
        projectId: result.project.id,
        projectTitle: result.project.title,
        group: group
          ? {
              id: group.id,
              name: group.name,
              totalMembers: students.length,
            }
          : null,
        finalizationStatus: result.status,
        weights: {
          advisorPercentage: result.advisorPercentage,
          evaluatorPercentage: result.evaluatorPercentage,
        },
        finalizedBy: {
          userId: result.finalizedBy.id,
          fullName: this.fullName(result.finalizedBy),
        },
        finalizedAt: result.finalizedAt,
        approvedAt: result.approvedAt,
        rejectedAt: result.rejectedAt,
        reviewedBy:
          result.status === ProjectStageFinalResultStatus.APPROVED && result.approvedBy
            ? {
                userId: result.approvedBy.id,
                fullName: this.fullName(result.approvedBy),
              }
            : result.status === ProjectStageFinalResultStatus.REJECTED && result.rejectedBy
              ? {
                  userId: result.rejectedBy.id,
                  fullName: this.fullName(result.rejectedBy),
                }
              : null,
        hasApprovalNote: Boolean(result.approvalNote),
        hasRejectionReason: Boolean(result.rejectionReason),
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
    this.ensureSupportedStage(query.stage);

    const actor = await this.resolveDepartmentHeadContext(user);
    const result = await this.repository.findDepartmentProjectFinalResultDetail({
      departmentId: actor.departmentId,
      projectId,
      stage: query.stage,
    });

    if (!result) {
      throw new NotFoundException('Finalized project result not found for this department head');
    }

    const group = result.project.proposal?.projectGroup;
    if (!group) {
      throw new BadRequestException('Project group not found for this project');
    }

    const students = this.normalizeStudents(group);
    const advisorEvaluation = result.project.advisorEvaluations[0] ?? null;
    const evaluatorEvaluationByUserId = new Map(
      result.project.evaluatorEvaluations.map((evaluation) => [evaluation.evaluatorUserId, evaluation])
    );
    const finalScoreByStudentId = new Map(result.scores.map((score) => [score.studentUserId, score]));

    const reviewHistory = [
      {
        action: 'FINALIZED',
        status: ProjectStageFinalResultStatus.FINALIZED_PENDING_DEPARTMENT_HEAD,
        actedBy: {
          userId: result.finalizedBy.id,
          fullName: this.fullName(result.finalizedBy),
        },
        actedAt: result.finalizedAt,
        note: result.finalizationNote,
      },
      ...(result.approvedAt && result.approvedBy
        ? [
            {
              action: 'APPROVED',
              status: ProjectStageFinalResultStatus.APPROVED,
              actedBy: {
                userId: result.approvedBy.id,
                fullName: this.fullName(result.approvedBy),
              },
              actedAt: result.approvedAt,
              note: result.approvalNote,
            },
          ]
        : []),
      ...(result.rejectedAt && result.rejectedBy
        ? [
            {
              action: 'REJECTED',
              status: ProjectStageFinalResultStatus.REJECTED,
              actedBy: {
                userId: result.rejectedBy.id,
                fullName: this.fullName(result.rejectedBy),
              },
              actedAt: result.rejectedAt,
              note: result.rejectionReason,
            },
          ]
        : []),
    ];

    return {
      stage: result.stage,
      project: {
        id: result.project.id,
        title: result.project.title,
        status: result.project.status,
        createdAt: result.project.createdAt,
      },
      group: {
        id: group.id,
        name: group.name,
        status: group.status,
        totalMembers: students.length,
        leader: {
          userId: group.leader.id,
          fullName: this.fullName(group.leader),
          email: group.leader.email,
        },
      },
      finalResult: {
        id: result.id,
        status: result.status,
        weights: {
          advisorPercentage: result.advisorPercentage,
          evaluatorPercentage: result.evaluatorPercentage,
        },
        finalizedBy: {
          userId: result.finalizedBy.id,
          fullName: this.fullName(result.finalizedBy),
        },
        finalizedAt: result.finalizedAt,
        finalizationNote: result.finalizationNote,
        approvedAt: result.approvedAt,
        approvalNote: result.approvalNote,
        rejectedAt: result.rejectedAt,
        rejectionReason: result.rejectionReason,
      },
      advisorEvaluation: {
        status: advisorEvaluation?.status ?? 'NOT_STARTED',
        submittedAt: advisorEvaluation?.submittedAt ?? null,
      },
      evaluatorEvaluation: {
        totalAssignedEvaluators: result.project.evaluators.length,
        submittedEvaluators: result.project.evaluatorEvaluations.filter((item) => item.status === 'SUBMITTED').length,
        evaluators: result.project.evaluators.map((assigned) => {
          const evaluation = evaluatorEvaluationByUserId.get(assigned.evaluatorUserId);

          return {
            evaluatorUserId: assigned.evaluator.id,
            fullName: this.fullName(assigned.evaluator),
            email: assigned.evaluator.email,
            status: evaluation?.status ?? 'NOT_STARTED',
            submittedAt: evaluation?.submittedAt ?? null,
          };
        }),
      },
      students: students.map((student) => {
        const advisorScore = advisorEvaluation?.scores.find((item) => item.studentUserId === student.id) ?? null;
        const finalScore = finalScoreByStudentId.get(student.id) ?? null;

        return {
          studentUserId: student.id,
          fullName: this.fullName(student),
          email: student.email,
          advisorScore: {
            score: advisorScore?.score ?? finalScore?.advisorScore ?? null,
            comment: advisorScore?.comment ?? finalScore?.advisorComment ?? null,
          },
          evaluatorScores: result.project.evaluators.map((assigned) => {
            const evaluation = evaluatorEvaluationByUserId.get(assigned.evaluatorUserId);
            const score = evaluation?.scores.find((item) => item.studentUserId === student.id) ?? null;

            return {
              evaluatorUserId: assigned.evaluator.id,
              evaluatorName: this.fullName(assigned.evaluator),
              score: score?.score ?? null,
              comment: score?.comment ?? null,
              status: score ? 'EVALUATED' : 'PENDING',
            };
          }),
          evaluatorAverageScore: finalScore?.evaluatorAverageScore ?? null,
          finalGrade: finalScore?.finalGrade ?? null,
          letterGrade: finalScore?.letterGrade ?? null,
          finalizedEvaluatorScores: finalScore ? this.parseEvaluatorScores(finalScore.evaluatorScores) : [],
        };
      }),
      reviewHistory,
      roundedToDecimalPlaces: 2,
      gradeScale: GRADE_SCALE,
    };
  }

  async approveProject(
    user: any,
    projectId: string,
    query: EvaluationStageQueryDto,
    body: ApproveDepartmentHeadProjectEvaluationDto
  ) {
    this.ensureSupportedStage(query.stage);

    const actor = await this.resolveDepartmentHeadContext(user);
    const finalResult = await this.repository.findDepartmentProjectFinalResult({
      departmentId: actor.departmentId,
      projectId,
      stage: query.stage,
    });

    if (!finalResult) {
      throw new NotFoundException('Finalized project result not found for this department head');
    }

    if (finalResult.status === ProjectStageFinalResultStatus.APPROVED) {
      throw new BadRequestException('Final grade has already been approved for this project and stage');
    }

    if (finalResult.status === ProjectStageFinalResultStatus.REJECTED) {
      throw new BadRequestException('Rejected final grade must be re-finalized by the coordinator before approval');
    }

    const saved = await this.repository.approveProjectStageFinalResult({
      finalResultId: finalResult.id,
      approvedByUserId: actor.id,
      approvalNote: body.note,
    });

    try {
      await this.notificationService.notifyProjectStageFinalResultApproved({
        tenantId: saved.tenantId,
        finalResultId: saved.id,
        projectId: saved.projectId,
        projectTitle: saved.project.title,
        recipientUserIds: this.extractStudentRecipientUserIds(finalResult.project.proposal?.projectGroup ?? null),
        reviewerUserId: actor.id,
        reviewerName: this.fullName(actor),
        note: body.note,
      });
    } catch (error) {
      this.logger.warn(
        `ProjectStageFinalResultApproved notifications failed for ${saved.id}: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return {
      finalResultId: saved.id,
      projectId: saved.projectId,
      stage: saved.stage,
      status: saved.status,
      finalizedBy: {
        userId: saved.finalizedBy.id,
        fullName: this.fullName(saved.finalizedBy),
      },
      finalizedAt: saved.finalizedAt,
      approvedBy: saved.approvedBy
        ? {
            userId: saved.approvedBy.id,
            fullName: this.fullName(saved.approvedBy),
          }
        : null,
      approvedAt: saved.approvedAt,
      note: saved.approvalNote ?? null,
    };
  }

  async rejectProject(
    user: any,
    projectId: string,
    query: EvaluationStageQueryDto,
    body: RejectDepartmentHeadProjectEvaluationDto
  ) {
    this.ensureSupportedStage(query.stage);

    const actor = await this.resolveDepartmentHeadContext(user);
    const finalResult = await this.repository.findDepartmentProjectFinalResult({
      departmentId: actor.departmentId,
      projectId,
      stage: query.stage,
    });

    if (!finalResult) {
      throw new NotFoundException('Finalized project result not found for this department head');
    }

    if (finalResult.status === ProjectStageFinalResultStatus.APPROVED) {
      throw new BadRequestException('Approved final grade cannot be rejected');
    }

    if (finalResult.status === ProjectStageFinalResultStatus.REJECTED) {
      throw new BadRequestException('Final grade has already been rejected for this project and stage');
    }

    const saved = await this.repository.rejectProjectStageFinalResult({
      finalResultId: finalResult.id,
      rejectedByUserId: actor.id,
      rejectionReason: body.reason.trim(),
    });

    try {
      await this.notificationService.notifyProjectStageFinalResultRejected({
        tenantId: saved.tenantId,
        finalResultId: saved.id,
        projectId: saved.projectId,
        projectTitle: saved.project.title,
        recipientUserId: finalResult.finalizedBy.id,
        reviewerUserId: actor.id,
        reviewerName: this.fullName(actor),
        rejectionReason: body.reason.trim(),
      });
    } catch (error) {
      this.logger.warn(
        `ProjectStageFinalResultRejected notifications failed for ${saved.id}: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return {
      finalResultId: saved.id,
      projectId: saved.projectId,
      stage: saved.stage,
      status: saved.status,
      finalizedBy: {
        userId: saved.finalizedBy.id,
        fullName: this.fullName(saved.finalizedBy),
      },
      finalizedAt: saved.finalizedAt,
      rejectedBy: saved.rejectedBy
        ? {
            userId: saved.rejectedBy.id,
            fullName: this.fullName(saved.rejectedBy),
          }
        : null,
      rejectedAt: saved.rejectedAt,
      reason: saved.rejectionReason ?? null,
    };
  }
}