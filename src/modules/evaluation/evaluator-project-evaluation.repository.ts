import {
  EvaluationStage,
  EvaluatorProjectEvaluationStatus,
  MilestoneStatus,
  ProjectStatus,
  UserStatus,
} from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

type CompactStudentUserRecord = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
  status: UserStatus;
};

type EvaluatorDashboardProjectRecord = {
  id: string;
  title: string;
  status: ProjectStatus;
  createdAt: Date;
  advisor: CompactStudentUserRecord | null;
  proposal: {
    projectGroup: {
      id: string;
      name: string;
      status: string;
      technologies: unknown;
      leader: CompactStudentUserRecord;
      members: { user: CompactStudentUserRecord }[];
    } | null;
  } | null;
  milestones: Array<{
    id: string;
    status: MilestoneStatus;
  }>;
  evaluators: Array<{
    evaluatorUserId: string;
  }>;
};

type EvaluatorDetailProjectRecord = {
  id: string;
  title: string;
  status: ProjectStatus;
  createdAt: Date;
  advisor: CompactStudentUserRecord | null;
  proposal: {
    projectGroup: {
      id: string;
      name: string;
      status: string;
      objectives: string | null;
      technologies: unknown;
      leader: CompactStudentUserRecord;
      members: { user: CompactStudentUserRecord }[];
    } | null;
  } | null;
  milestones: Array<{
    id: string;
    title: string;
    description: string | null;
    dueDate: Date;
    status: MilestoneStatus;
    submittedAt: Date | null;
    submissions: Array<{
      id: string;
      fileName: string;
      mimeType: string;
      fileUrl: string;
      approvedAt: Date | null;
      approvedBy: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
      } | null;
    }>;
  }>;
};

@Injectable()
export class EvaluatorProjectEvaluationRepository {
  constructor(private readonly prisma: PrismaService) {}

  private dedupeProjectsByGroupLatest(items: EvaluatorDashboardProjectRecord[]) {
    const byKey = new Map<string, EvaluatorDashboardProjectRecord>();

    for (const item of items) {
      const groupId = String(item.proposal?.projectGroup?.id ?? '').trim();
      const key = groupId || item.id;
      const existing = byKey.get(key);

      if (!existing || item.createdAt.getTime() > existing.createdAt.getTime()) {
        byKey.set(key, item);
      }
    }

    return Array.from(byKey.values()).sort(
      (left, right) => right.createdAt.getTime() - left.createdAt.getTime()
    );
  }

  async findEvaluatorUserById(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        tenantId: true,
        departmentId: true,
        status: true,
        firstName: true,
        lastName: true,
        email: true,
        avatarUrl: true,
      },
    });
  }

  async listEvaluatorProjectsDashboard(evaluatorUserId: string) {
    const projects = await this.prisma.project.findMany({
      where: {
        status: ProjectStatus.ACTIVE,
        evaluators: {
          some: {
            evaluatorUserId,
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        advisor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
            status: true,
          },
        },
        proposal: {
          select: {
            projectGroup: {
              select: {
                id: true,
                name: true,
                status: true,
                technologies: true,
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
        milestones: {
          select: {
            id: true,
            status: true,
          },
        },
        evaluators: {
          select: {
            evaluatorUserId: true,
          },
        },
      },
    });

    return this.dedupeProjectsByGroupLatest(projects as EvaluatorDashboardProjectRecord[]);
  }

  async listEvaluatorEvaluationsForProjects(params: {
    evaluatorUserId: string;
    stage: EvaluationStage;
    projectIds: string[];
  }) {
    if (params.projectIds.length === 0) {
      return [];
    }

    return this.prisma.evaluatorProjectEvaluation.findMany({
      where: {
        evaluatorUserId: params.evaluatorUserId,
        stage: params.stage,
        projectId: { in: params.projectIds },
      },
      select: {
        id: true,
        projectId: true,
        status: true,
        lastSavedAt: true,
        submittedAt: true,
        scores: {
          select: {
            studentUserId: true,
            score: true,
            updatedAt: true,
          },
        },
      },
    });
  }

  async findEvaluatorProjectDetail(params: {
    evaluatorUserId: string;
    projectId: string;
    stage: EvaluationStage;
  }) {
    const project = await this.prisma.project.findFirst({
      where: {
        id: params.projectId,
        evaluators: {
          some: {
            evaluatorUserId: params.evaluatorUserId,
          },
        },
      },
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        advisor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
            status: true,
          },
        },
        proposal: {
          select: {
            projectGroup: {
              select: {
                id: true,
                name: true,
                status: true,
                objectives: true,
                technologies: true,
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
        milestones: {
          orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            title: true,
            description: true,
            dueDate: true,
            status: true,
            submittedAt: true,
            submissions: {
              where: { status: 'APPROVED' },
              orderBy: [{ approvedAt: 'desc' }, { createdAt: 'desc' }],
              take: 1,
              select: {
                id: true,
                fileName: true,
                mimeType: true,
                fileUrl: true,
                approvedAt: true,
                approvedBy: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!project) {
      return null;
    }

    const evaluation = await this.prisma.evaluatorProjectEvaluation.findFirst({
      where: {
        projectId: params.projectId,
        evaluatorUserId: params.evaluatorUserId,
        stage: params.stage,
      },
      select: {
        id: true,
        status: true,
        lastSavedAt: true,
        submittedAt: true,
        updatedAt: true,
        scores: {
          select: {
            studentUserId: true,
            score: true,
            comment: true,
            updatedAt: true,
          },
        },
      },
    });

    return { project: project as EvaluatorDetailProjectRecord, evaluation };
  }

  async saveEvaluatorProjectEvaluationDraft(params: {
    tenantId: string;
    departmentId: string;
    projectId: string;
    evaluatorUserId: string;
    stage: EvaluationStage;
    students: Array<{
      studentUserId: string;
      score: number;
      comment?: string;
    }>;
  }) {
    return this.prisma.$transaction(async (tx) => {
      let evaluation = await tx.evaluatorProjectEvaluation.findFirst({
        where: {
          projectId: params.projectId,
          evaluatorUserId: params.evaluatorUserId,
          stage: params.stage,
        },
        select: {
          id: true,
          status: true,
          submittedAt: true,
        },
      });

      if (evaluation?.status === EvaluatorProjectEvaluationStatus.SUBMITTED) {
        throw new Error('SUBMITTED_EVALUATION_LOCKED');
      }

      const now = new Date();

      if (!evaluation) {
        evaluation = await tx.evaluatorProjectEvaluation.create({
          data: {
            tenantId: params.tenantId,
            departmentId: params.departmentId,
            projectId: params.projectId,
            evaluatorUserId: params.evaluatorUserId,
            stage: params.stage,
            status: EvaluatorProjectEvaluationStatus.IN_PROGRESS,
            lastSavedAt: now,
          },
          select: {
            id: true,
            status: true,
            submittedAt: true,
          },
        });
      } else {
        evaluation = await tx.evaluatorProjectEvaluation.update({
          where: { id: evaluation.id },
          data: {
            status: EvaluatorProjectEvaluationStatus.IN_PROGRESS,
            lastSavedAt: now,
          },
          select: {
            id: true,
            status: true,
            submittedAt: true,
          },
        });
      }

      for (const student of params.students) {
        const existing = await tx.evaluatorProjectEvaluationScore.findUnique({
          where: {
            evaluationId_studentUserId: {
              evaluationId: evaluation.id,
              studentUserId: student.studentUserId,
            },
          },
          select: { id: true },
        });

        if (existing) {
          await tx.evaluatorProjectEvaluationScore.update({
            where: { id: existing.id },
            data: {
              score: student.score,
              comment: student.comment?.trim() || null,
            },
          });
        } else {
          await tx.evaluatorProjectEvaluationScore.create({
            data: {
              evaluationId: evaluation.id,
              studentUserId: student.studentUserId,
              score: student.score,
              comment: student.comment?.trim() || null,
            },
          });
        }
      }

      return tx.evaluatorProjectEvaluation.findUnique({
        where: { id: evaluation.id },
        select: {
          id: true,
          projectId: true,
          status: true,
          lastSavedAt: true,
          submittedAt: true,
          scores: {
            select: {
              studentUserId: true,
              score: true,
              comment: true,
              updatedAt: true,
            },
          },
        },
      });
    });
  }

  async submitEvaluatorProjectEvaluation(params: {
    projectId: string;
    evaluatorUserId: string;
    stage: EvaluationStage;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const evaluation = await tx.evaluatorProjectEvaluation.findFirst({
        where: {
          projectId: params.projectId,
          evaluatorUserId: params.evaluatorUserId,
          stage: params.stage,
        },
        select: {
          id: true,
          status: true,
          submittedAt: true,
        },
      });

      if (!evaluation) {
        throw new Error('EVALUATION_NOT_FOUND');
      }

      if (evaluation.status === EvaluatorProjectEvaluationStatus.SUBMITTED) {
        throw new Error('EVALUATION_ALREADY_SUBMITTED');
      }

      const submittedAt = new Date();

      return tx.evaluatorProjectEvaluation.update({
        where: { id: evaluation.id },
        data: {
          status: EvaluatorProjectEvaluationStatus.SUBMITTED,
          submittedAt,
          lastSavedAt: submittedAt,
        },
        select: {
          id: true,
          projectId: true,
          status: true,
          lastSavedAt: true,
          submittedAt: true,
          scores: {
            select: {
              studentUserId: true,
              score: true,
              comment: true,
              updatedAt: true,
            },
          },
        },
      });
    });
  }
}