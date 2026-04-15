import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { EvaluationStage, ProjectStageFinalResultStatus } from '@prisma/client';
import { EvaluationStageQueryDto } from './dto';
import { StudentProjectFinalGradeRepository } from './student-project-final-grade.repository';

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

@Injectable()
export class StudentProjectFinalGradeService {
  constructor(private readonly repository: StudentProjectFinalGradeRepository) {}

  private ensureSupportedStage(stage: EvaluationStage) {
    if (stage !== EvaluationStage.CAPSTONE_I) {
      throw new BadRequestException('Only CAPSTONE_I is supported for now');
    }
  }

  private fullName(person: { firstName: string; lastName: string }) {
    return `${String(person.firstName ?? '').trim()} ${String(person.lastName ?? '').trim()}`.trim();
  }

  async getMyFinalGrade(user: any, query: EvaluationStageQueryDto) {
    this.ensureSupportedStage(query.stage);

    if (!user?.sub) {
      throw new ForbiddenException('Missing user context');
    }

    const result = await this.repository.findLatestStudentStageFinalResult(user.sub, query.stage);

    if (!result) {
      return {
        stage: query.stage,
        isPublished: false,
        status: 'NOT_AVAILABLE',
        message: 'No finalized result is available for this stage yet.',
      };
    }

    const group = result.finalResult.project.proposal?.projectGroup;
    const groupMembers = group
      ? [group.leader, ...group.members.map((member) => member.user)]
          .filter((student, index, collection) => {
            const id = student?.id;
            return Boolean(id) && collection.findIndex((item) => item?.id === id) === index;
          })
          .map((student) => ({
            userId: student.id,
            fullName: this.fullName(student),
            email: student.email,
          }))
      : [];

    if (result.finalResult.status !== ProjectStageFinalResultStatus.APPROVED) {
      return {
        stage: query.stage,
        isPublished: false,
        status: result.finalResult.status,
        project: {
          id: result.finalResult.project.id,
          title: result.finalResult.project.title,
          status: result.finalResult.project.status,
        },
        group: group
          ? {
              id: group.id,
              name: group.name,
              status: group.status,
              totalMembers: groupMembers.length,
            }
          : null,
        message:
          result.finalResult.status === ProjectStageFinalResultStatus.REJECTED
            ? 'Your final result is not published because it was returned for coordinator review.'
            : 'Your final result is not published yet. It is still awaiting department-head approval.',
      };
    }

    return {
      stage: result.finalResult.stage,
      isPublished: true,
      status: result.finalResult.status,
      project: {
        id: result.finalResult.project.id,
        title: result.finalResult.project.title,
        status: result.finalResult.project.status,
      },
      group: group
        ? {
            id: group.id,
            name: group.name,
            status: group.status,
            totalMembers: groupMembers.length,
          }
        : null,
      weights: {
        advisorPercentage: result.finalResult.advisorPercentage,
        evaluatorPercentage: result.finalResult.evaluatorPercentage,
      },
      scores: {
        advisorScore: result.advisorScore,
        evaluatorAverageScore: result.evaluatorAverageScore,
        finalGrade: result.finalGrade,
        letterGrade: result.letterGrade,
      },
      finalizedAt: result.finalResult.finalizedAt,
      publishedAt: result.finalResult.approvedAt,
      roundedToDecimalPlaces: 2,
      gradeScale: GRADE_SCALE,
    };
  }
}