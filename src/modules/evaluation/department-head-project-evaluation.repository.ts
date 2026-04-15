import { EvaluationStage, ProjectStageFinalResultStatus, UserStatus } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

type DashboardStudentUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: UserStatus;
};

type DepartmentHeadDashboardRecord = {
  id: string;
  status: ProjectStageFinalResultStatus;
  advisorPercentage: number;
  evaluatorPercentage: number;
  finalizedAt: Date;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  approvalNote: string | null;
  rejectionReason: string | null;
  project: {
    id: string;
    title: string;
    proposal: {
      projectGroup: {
        id: string;
        name: string;
        leader: DashboardStudentUser;
        members: { user: DashboardStudentUser }[];
      } | null;
    } | null;
  };
  finalizedBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
  approvedBy: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  rejectedBy: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
};

type DepartmentHeadDetailRecord = {
  id: string;
  stage: EvaluationStage;
  status: ProjectStageFinalResultStatus;
  advisorPercentage: number;
  evaluatorPercentage: number;
  finalizedAt: Date;
  finalizationNote: string | null;
  approvedAt: Date | null;
  approvalNote: string | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  project: {
    id: string;
    title: string;
    status: string;
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
  };
  finalizedBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
  approvedBy: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  rejectedBy: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  scores: {
    studentUserId: string;
    advisorScore: number;
    advisorComment: string | null;
    evaluatorAverageScore: number;
    evaluatorScores: unknown;
    finalGrade: number;
    letterGrade: string;
  }[];
};

@Injectable()
export class DepartmentHeadProjectEvaluationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listDepartmentStageFinalResults(params: { departmentId: string; stage: EvaluationStage }) {
    return this.prisma.projectStageFinalResult.findMany({
      where: {
        departmentId: params.departmentId,
        stage: params.stage,
      },
      orderBy: [{ finalizedAt: 'desc' }],
      select: {
        id: true,
        status: true,
        advisorPercentage: true,
        evaluatorPercentage: true,
        finalizedAt: true,
        approvedAt: true,
        rejectedAt: true,
        approvalNote: true,
        rejectionReason: true,
        project: {
          select: {
            id: true,
            title: true,
            proposal: {
              select: {
                projectGroup: {
                  select: {
                    id: true,
                    name: true,
                    leader: {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
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
                            status: true,
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
        finalizedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        approvedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        rejectedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    }) as Promise<DepartmentHeadDashboardRecord[]>;
  }

  async findDepartmentProjectFinalResultDetail(params: {
    departmentId: string;
    projectId: string;
    stage: EvaluationStage;
  }) {
    return this.prisma.projectStageFinalResult.findFirst({
      where: {
        departmentId: params.departmentId,
        projectId: params.projectId,
        stage: params.stage,
      },
      select: {
        id: true,
        stage: true,
        status: true,
        advisorPercentage: true,
        evaluatorPercentage: true,
        finalizedAt: true,
        finalizationNote: true,
        approvedAt: true,
        approvalNote: true,
        rejectedAt: true,
        rejectionReason: true,
        project: {
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
          },
        },
        finalizedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        approvedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        rejectedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        scores: {
          orderBy: { createdAt: 'asc' },
          select: {
            studentUserId: true,
            advisorScore: true,
            advisorComment: true,
            evaluatorAverageScore: true,
            evaluatorScores: true,
            finalGrade: true,
            letterGrade: true,
          },
        },
      },
    }) as Promise<DepartmentHeadDetailRecord | null>;
  }

  async findDepartmentProjectFinalResult(params: {
    departmentId: string;
    projectId: string;
    stage: EvaluationStage;
  }) {
    return this.prisma.projectStageFinalResult.findFirst({
      where: {
        departmentId: params.departmentId,
        projectId: params.projectId,
        stage: params.stage,
      },
      select: {
        id: true,
        tenantId: true,
        projectId: true,
        stage: true,
        status: true,
        approvedAt: true,
        rejectedAt: true,
        project: {
          select: {
            id: true,
            title: true,
            proposal: {
              select: {
                projectGroup: {
                  select: {
                    id: true,
                    leader: {
                      select: {
                        id: true,
                      },
                    },
                    members: {
                      select: {
                        user: {
                          select: {
                            id: true,
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
        finalizedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        approvedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        rejectedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async approveProjectStageFinalResult(params: {
    finalResultId: string;
    approvedByUserId: string;
    approvalNote?: string;
  }) {
    return this.prisma.projectStageFinalResult.update({
      where: { id: params.finalResultId },
      data: {
        status: ProjectStageFinalResultStatus.APPROVED,
        approvedByUserId: params.approvedByUserId,
        approvedAt: new Date(),
        approvalNote: params.approvalNote,
        rejectedByUserId: null,
        rejectedAt: null,
        rejectionReason: null,
      },
      select: {
        id: true,
        tenantId: true,
        projectId: true,
        stage: true,
        status: true,
        finalizedAt: true,
        approvedAt: true,
        approvalNote: true,
        project: {
          select: {
            title: true,
          },
        },
        finalizedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        approvedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async rejectProjectStageFinalResult(params: {
    finalResultId: string;
    rejectedByUserId: string;
    rejectionReason: string;
  }) {
    return this.prisma.projectStageFinalResult.update({
      where: { id: params.finalResultId },
      data: {
        status: ProjectStageFinalResultStatus.REJECTED,
        rejectedByUserId: params.rejectedByUserId,
        rejectedAt: new Date(),
        rejectionReason: params.rejectionReason,
        approvedByUserId: null,
        approvedAt: null,
        approvalNote: null,
      },
      select: {
        id: true,
        tenantId: true,
        projectId: true,
        stage: true,
        status: true,
        finalizedAt: true,
        rejectedAt: true,
        rejectionReason: true,
        project: {
          select: {
            title: true,
          },
        },
        finalizedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        rejectedBy: {
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