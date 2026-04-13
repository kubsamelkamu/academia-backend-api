import {
  AdvisorProjectEvaluationStatus,
  EvaluationStage,
  MilestoneStatus,
  ProjectStatus,
  UserStatus,
} from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

type DashboardProjectRecord = {
  id: string;
  title: string;
  status: ProjectStatus;
  createdAt: Date;
  proposal: {
    projectGroup: {
      id: string;
      name: string;
      status: string;
      leader: StudentUserRecord;
      members: { user: StudentUserRecord }[];
    } | null;
  } | null;
  milestones: {
    id: string;
    status: MilestoneStatus;
  }[];
};

type StudentUserRecord = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
  status: UserStatus;
  student: {
    id: string;
    bio: string | null;
    githubUrl: string | null;
    linkedinUrl: string | null;
    portfolioUrl: string | null;
    techStack: unknown;
  } | null;
};

@Injectable()
export class AdvisorProjectEvaluationRepository {
  constructor(private readonly prisma: PrismaService) {}

  private dedupeProjectsByGroupLatest(items: DashboardProjectRecord[]) {
    const byKey = new Map<string, DashboardProjectRecord>();

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

  async findAdvisorByUserId(userId: string) {
    return this.prisma.advisor.findUnique({
      where: { userId },
      select: {
        id: true,
        userId: true,
        departmentId: true,
        user: {
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
        },
      },
    });
  }

  async listAdvisorProjectsDashboard(advisorUserId: string) {
    const projects = await this.prisma.project.findMany({
      where: {
        advisorId: advisorUserId,
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
                    student: {
                      select: {
                        id: true,
                        bio: true,
                        githubUrl: true,
                        linkedinUrl: true,
                        portfolioUrl: true,
                        techStack: true,
                      },
                    },
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
                        student: {
                          select: {
                            id: true,
                            bio: true,
                            githubUrl: true,
                            linkedinUrl: true,
                            portfolioUrl: true,
                            techStack: true,
                          },
                        },
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
      },
    });

    return this.dedupeProjectsByGroupLatest(projects as DashboardProjectRecord[]);
  }

  async listAdvisorEvaluationsForProjects(params: {
    advisorUserId: string;
    stage: EvaluationStage;
    projectIds: string[];
  }) {
    if (params.projectIds.length === 0) {
      return [];
    }

    return this.prisma.advisorProjectEvaluation.findMany({
      where: {
        advisorUserId: params.advisorUserId,
        stage: params.stage,
        projectId: { in: params.projectIds },
      },
      select: {
        id: true,
        projectId: true,
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
  }

  async findAdvisorProjectDetail(params: {
    advisorUserId: string;
    projectId: string;
    stage: EvaluationStage;
  }) {
    const project = await this.prisma.project.findFirst({
      where: {
        id: params.projectId,
        advisorId: params.advisorUserId,
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
                    student: {
                      select: {
                        id: true,
                        bio: true,
                        githubUrl: true,
                        linkedinUrl: true,
                        portfolioUrl: true,
                        techStack: true,
                      },
                    },
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
                        student: {
                          select: {
                            id: true,
                            bio: true,
                            githubUrl: true,
                            linkedinUrl: true,
                            portfolioUrl: true,
                            techStack: true,
                          },
                        },
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

    const evaluation = await this.prisma.advisorProjectEvaluation.findFirst({
      where: {
        projectId: params.projectId,
        advisorUserId: params.advisorUserId,
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

    return { project, evaluation };
  }

  async saveAdvisorProjectEvaluationDraft(params: {
    tenantId: string;
    departmentId: string;
    projectId: string;
    advisorUserId: string;
    stage: EvaluationStage;
    students: Array<{
      studentUserId: string;
      score: number;
      comment?: string;
    }>;
  }) {
    return this.prisma.$transaction(async (tx) => {
      let evaluation = await tx.advisorProjectEvaluation.findFirst({
        where: {
          projectId: params.projectId,
          advisorUserId: params.advisorUserId,
          stage: params.stage,
        },
        select: {
          id: true,
          status: true,
          submittedAt: true,
        },
      });

      if (evaluation?.status === AdvisorProjectEvaluationStatus.SUBMITTED) {
        throw new Error('SUBMITTED_EVALUATION_LOCKED');
      }

      const now = new Date();

      if (!evaluation) {
        evaluation = await tx.advisorProjectEvaluation.create({
          data: {
            tenantId: params.tenantId,
            departmentId: params.departmentId,
            projectId: params.projectId,
            advisorUserId: params.advisorUserId,
            stage: params.stage,
            status: AdvisorProjectEvaluationStatus.IN_PROGRESS,
            lastSavedAt: now,
          },
          select: {
            id: true,
            status: true,
            submittedAt: true,
          },
        });
      } else {
        evaluation = await tx.advisorProjectEvaluation.update({
          where: { id: evaluation.id },
          data: {
            status: AdvisorProjectEvaluationStatus.IN_PROGRESS,
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
        const existing = await tx.advisorProjectEvaluationScore.findUnique({
          where: {
            evaluationId_studentUserId: {
              evaluationId: evaluation.id,
              studentUserId: student.studentUserId,
            },
          },
          select: { id: true },
        });

        if (existing) {
          await tx.advisorProjectEvaluationScore.update({
            where: { id: existing.id },
            data: {
              score: student.score,
              comment: student.comment?.trim() || null,
            },
          });
        } else {
          await tx.advisorProjectEvaluationScore.create({
            data: {
              evaluationId: evaluation.id,
              studentUserId: student.studentUserId,
              score: student.score,
              comment: student.comment?.trim() || null,
            },
          });
        }
      }

      return tx.advisorProjectEvaluation.findUnique({
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
}