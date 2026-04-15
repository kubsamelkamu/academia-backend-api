import { EvaluationStage, ProjectStatus, ProjectStageFinalResultStatus, UserStatus } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

type DashboardStudentUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
  status: UserStatus;
};

type CoordinatorDashboardProjectRecord = {
  id: string;
  title: string;
  status: ProjectStatus;
  createdAt: Date;
  proposal: {
    projectGroup: {
      id: string;
      name: string;
      status: string;
      leader: DashboardStudentUser;
      members: { user: DashboardStudentUser }[];
    } | null;
  } | null;
  advisorEvaluations: {
    status: string;
    submittedAt: Date | null;
  }[];
  evaluators: {
    evaluatorUserId: string;
  }[];
  evaluatorEvaluations: {
    evaluatorUserId: string;
    status: string;
    submittedAt: Date | null;
  }[];
  stageFinalResults: {
    status: ProjectStageFinalResultStatus;
    advisorPercentage: number;
    evaluatorPercentage: number;
    finalizedAt: Date;
    approvedAt: Date | null;
    rejectionReason: string | null;
    finalizedBy: {
      id: string;
      firstName: string;
      lastName: string;
    };
  }[];
};

type CoordinatorDetailProjectRecord = {
  id: string;
  title: string;
  status: ProjectStatus;
  createdAt: Date;
  proposal: {
    projectGroup: {
      id: string;
      name: string;
      status: string;
      leader: DashboardStudentUser;
      members: { user: DashboardStudentUser }[];
    } | null;
  } | null;
  advisorEvaluations: {
    status: string;
    submittedAt: Date | null;
    scores: {
      studentUserId: string;
      score: number;
      comment: string | null;
    }[];
  }[];
  evaluators: {
    evaluatorUserId: string;
    evaluator: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
  }[];
  evaluatorEvaluations: {
    evaluatorUserId: string;
    status: string;
    submittedAt: Date | null;
    scores: {
      studentUserId: string;
      score: number;
      comment: string | null;
    }[];
  }[];
  stageFinalResults: {
    status: ProjectStageFinalResultStatus;
    advisorPercentage: number;
    evaluatorPercentage: number;
    finalizedAt: Date;
    approvedAt: Date | null;
    rejectedAt: Date | null;
    rejectionReason: string | null;
  }[];
};

@Injectable()
export class CoordinatorProjectEvaluationRepository {
  constructor(private readonly prisma: PrismaService) {}

  private dedupeProjectsByGroupLatest(items: CoordinatorDashboardProjectRecord[]) {
    const byKey = new Map<string, CoordinatorDashboardProjectRecord>();

    for (const item of items) {
      const groupId = String(item.proposal?.projectGroup?.id ?? '').trim();
      const key = groupId || item.id;
      const existing = byKey.get(key);

      if (!existing || item.createdAt.getTime() > existing.createdAt.getTime()) {
        byKey.set(key, item);
      }
    }

    return Array.from(byKey.values()).sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  }

  async listDepartmentProjectsForDashboard(params: {
    departmentId: string;
    stage: EvaluationStage;
  }) {
    const projects = await this.prisma.project.findMany({
      where: {
        departmentId: params.departmentId,
        status: ProjectStatus.ACTIVE,
      },
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        proposal: {
          select: {
            projectGroup: {
              select: {
                id: true,
                name: true,
                status: true,
                leader: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    avatarUrl: true,
                    status: true,
                  },
                },
                members: {
                  orderBy: { joinedAt: 'asc' },
                  select: {
                    user: {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        avatarUrl: true,
                        status: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        advisorEvaluations: {
          where: { stage: params.stage },
          select: {
            status: true,
            submittedAt: true,
          },
        },
        evaluators: {
          select: {
            evaluatorUserId: true,
          },
        },
        evaluatorEvaluations: {
          where: { stage: params.stage },
          select: {
            evaluatorUserId: true,
            status: true,
            submittedAt: true,
          },
        },
        stageFinalResults: {
          where: { stage: params.stage },
          select: {
            status: true,
            advisorPercentage: true,
            evaluatorPercentage: true,
            finalizedAt: true,
            approvedAt: true,
            rejectionReason: true,
            finalizedBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    return this.dedupeProjectsByGroupLatest(projects as CoordinatorDashboardProjectRecord[]);
  }

  async findDepartmentProjectDetail(params: {
    departmentId: string;
    projectId: string;
    stage: EvaluationStage;
  }) {
    const project = await this.prisma.project.findFirst({
      where: {
        id: params.projectId,
        departmentId: params.departmentId,
      },
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        proposal: {
          select: {
            projectGroup: {
              select: {
                id: true,
                name: true,
                status: true,
                leader: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    avatarUrl: true,
                    status: true,
                  },
                },
                members: {
                  orderBy: { joinedAt: 'asc' },
                  select: {
                    user: {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        avatarUrl: true,
                        status: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        advisorEvaluations: {
          where: { stage: params.stage },
          select: {
            status: true,
            submittedAt: true,
            scores: {
              select: {
                studentUserId: true,
                score: true,
                comment: true,
              },
            },
          },
        },
        evaluators: {
          select: {
            evaluatorUserId: true,
            evaluator: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        evaluatorEvaluations: {
          where: { stage: params.stage },
          select: {
            evaluatorUserId: true,
            status: true,
            submittedAt: true,
            scores: {
              select: {
                studentUserId: true,
                score: true,
                comment: true,
              },
            },
          },
        },
        stageFinalResults: {
          where: { stage: params.stage },
          select: {
            status: true,
            advisorPercentage: true,
            evaluatorPercentage: true,
            finalizedAt: true,
            approvedAt: true,
            rejectedAt: true,
            rejectionReason: true,
          },
        },
      },
    });

    return project as CoordinatorDetailProjectRecord | null;
  }

  async upsertProjectStageFinalResult(params: {
    tenantId: string;
    departmentId: string;
    projectId: string;
    stage: EvaluationStage;
    advisorPercentage: number;
    evaluatorPercentage: number;
    finalizedByUserId: string;
    finalizationNote?: string;
    students: Array<{
      studentUserId: string;
      advisorScore: number;
      advisorComment?: string | null;
      evaluatorAverageScore: number;
      evaluatorScores: Array<{
        evaluatorUserId: string;
        evaluatorName: string;
        score: number;
        comment?: string | null;
      }>;
      finalGrade: number;
      letterGrade: string;
    }>;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.projectStageFinalResult.findUnique({
        where: {
          projectId_stage: {
            projectId: params.projectId,
            stage: params.stage,
          },
        },
        select: {
          id: true,
          status: true,
        },
      });

      if (existing?.status === ProjectStageFinalResultStatus.APPROVED) {
        throw new Error('FINAL_RESULT_ALREADY_APPROVED');
      }

      const finalResult = existing
        ? await tx.projectStageFinalResult.update({
            where: { id: existing.id },
            data: {
              status: ProjectStageFinalResultStatus.FINALIZED_PENDING_DEPARTMENT_HEAD,
              advisorPercentage: params.advisorPercentage,
              evaluatorPercentage: params.evaluatorPercentage,
              finalizedByUserId: params.finalizedByUserId,
              finalizedAt: new Date(),
              finalizationNote: params.finalizationNote?.trim() || null,
              approvedByUserId: null,
              approvedAt: null,
              approvalNote: null,
              rejectedByUserId: null,
              rejectedAt: null,
              rejectionReason: null,
            },
            select: {
              id: true,
              projectId: true,
              stage: true,
              status: true,
              advisorPercentage: true,
              evaluatorPercentage: true,
              finalizedAt: true,
              finalizationNote: true,
              finalizedBy: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          })
        : await tx.projectStageFinalResult.create({
            data: {
              tenantId: params.tenantId,
              departmentId: params.departmentId,
              projectId: params.projectId,
              stage: params.stage,
              status: ProjectStageFinalResultStatus.FINALIZED_PENDING_DEPARTMENT_HEAD,
              advisorPercentage: params.advisorPercentage,
              evaluatorPercentage: params.evaluatorPercentage,
              finalizedByUserId: params.finalizedByUserId,
              finalizedAt: new Date(),
              finalizationNote: params.finalizationNote?.trim() || null,
            },
            select: {
              id: true,
              projectId: true,
              stage: true,
              status: true,
              advisorPercentage: true,
              evaluatorPercentage: true,
              finalizedAt: true,
              finalizationNote: true,
              finalizedBy: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          });

      await tx.projectStageFinalResultScore.deleteMany({
        where: {
          finalResultId: finalResult.id,
        },
      });

      await tx.projectStageFinalResultScore.createMany({
        data: params.students.map((student) => ({
          finalResultId: finalResult.id,
          studentUserId: student.studentUserId,
          advisorScore: student.advisorScore,
          advisorComment: student.advisorComment?.trim() || null,
          evaluatorAverageScore: student.evaluatorAverageScore,
          evaluatorScores: student.evaluatorScores,
          finalGrade: student.finalGrade,
          letterGrade: student.letterGrade,
        })),
      });

      const scores = await tx.projectStageFinalResultScore.findMany({
        where: {
          finalResultId: finalResult.id,
        },
        select: {
          studentUserId: true,
          finalGrade: true,
          letterGrade: true,
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      return {
        ...finalResult,
        scores,
      };
    });
  }
}