import { EvaluationStage } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class StudentProjectFinalGradeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findLatestStudentStageFinalResult(studentUserId: string, stage: EvaluationStage) {
    return this.prisma.projectStageFinalResultScore.findFirst({
      where: {
        studentUserId,
        finalResult: {
          stage,
        },
      },
      orderBy: [{ finalResult: { updatedAt: 'desc' } }],
      select: {
        studentUserId: true,
        advisorScore: true,
        evaluatorAverageScore: true,
        finalGrade: true,
        letterGrade: true,
        finalResult: {
          select: {
            id: true,
            stage: true,
            status: true,
            advisorPercentage: true,
            evaluatorPercentage: true,
            finalizedAt: true,
            approvedAt: true,
            project: {
              select: {
                id: true,
                title: true,
                status: true,
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
          },
        },
      },
    });
  }
}