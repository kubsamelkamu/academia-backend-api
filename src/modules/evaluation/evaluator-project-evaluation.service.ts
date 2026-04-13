import {
  EvaluationStage,
  EvaluatorProjectEvaluationStatus,
  MilestoneStatus,
  UserStatus,
} from '@prisma/client';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EvaluationStageQueryDto, SaveAdvisorProjectEvaluationDraftDto } from './dto';
import { EvaluatorProjectEvaluationRepository } from './evaluator-project-evaluation.repository';

@Injectable()
export class EvaluatorProjectEvaluationService {
  constructor(private readonly repository: EvaluatorProjectEvaluationRepository) {}

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

  private buildMilestoneSummary(milestones: Array<{ status: MilestoneStatus }>) {
    const summary = {
      total: milestones.length,
      approved: 0,
      submitted: 0,
      pending: 0,
      rejected: 0,
      progressPercent: 0,
    };

    for (const milestone of milestones) {
      if (milestone.status === MilestoneStatus.APPROVED) summary.approved += 1;
      if (milestone.status === MilestoneStatus.SUBMITTED) summary.submitted += 1;
      if (milestone.status === MilestoneStatus.PENDING) summary.pending += 1;
      if (milestone.status === MilestoneStatus.REJECTED) summary.rejected += 1;
    }

    summary.progressPercent = summary.total
      ? Math.floor((summary.approved / summary.total) * 100)
      : 0;

    return summary;
  }

  private toGroupEvaluationStatus(params: {
    evaluatedStudents: number;
    submittedAt: Date | null;
  }) {
    if (params.submittedAt) {
      return EvaluatorProjectEvaluationStatus.SUBMITTED;
    }

    if (params.evaluatedStudents === 0) {
      return EvaluatorProjectEvaluationStatus.NOT_STARTED;
    }

    return EvaluatorProjectEvaluationStatus.IN_PROGRESS;
  }

  async getEvaluatorDashboard(user: any, query: EvaluationStageQueryDto) {
    if (!user?.sub) {
      throw new ForbiddenException('Missing user context');
    }

    this.ensureSupportedStage(query.stage);

    const evaluator = await this.repository.findEvaluatorUserById(user.sub);
    if (!evaluator) {
      throw new NotFoundException('Evaluator user not found');
    }

    const projects = await this.repository.listEvaluatorProjectsDashboard(evaluator.id);
    const evaluations = await this.repository.listEvaluatorEvaluationsForProjects({
      evaluatorUserId: evaluator.id,
      stage: query.stage,
      projectIds: projects.map((project) => project.id),
    });

    const evaluationByProjectId = new Map(
      evaluations.map((evaluation) => [evaluation.projectId, evaluation])
    );

    let totalAssignedStudents = 0;
    let studentsEvaluated = 0;
    let scoreTotal = 0;
    let totalScoreEntries = 0;
    let completedProjectGroups = 0;
    let totalApprovedMilestones = 0;
    let totalMilestones = 0;

    const projectGroups = projects.map((project) => {
      const group = project.proposal?.projectGroup;
      const students = group ? this.normalizeStudents(group) : [];
      const evaluation = evaluationByProjectId.get(project.id);
      const milestoneSummary = this.buildMilestoneSummary(project.milestones);
      const evaluatedStudentsCount = evaluation?.scores.length ?? 0;
      const studentsPendingEvaluation = Math.max(students.length - evaluatedStudentsCount, 0);
      const averageScoreGiven = evaluatedStudentsCount
        ? Number(
            (
              (evaluation?.scores.reduce((sum, score) => sum + score.score, 0) ?? 0) /
              evaluatedStudentsCount
            ).toFixed(2)
          )
        : 0;

      totalAssignedStudents += students.length;
      studentsEvaluated += evaluatedStudentsCount;
      scoreTotal += evaluation?.scores.reduce((sum, score) => sum + score.score, 0) ?? 0;
      totalScoreEntries += evaluatedStudentsCount;
      totalApprovedMilestones += milestoneSummary.approved;
      totalMilestones += milestoneSummary.total;

      if (evaluation?.submittedAt && studentsPendingEvaluation === 0 && students.length > 0) {
        completedProjectGroups += 1;
      }

      const evaluationStatus = this.toGroupEvaluationStatus({
        evaluatedStudents: evaluatedStudentsCount,
        submittedAt: evaluation?.submittedAt ?? null,
      });

      return {
        projectId: project.id,
        projectTitle: project.title,
        projectStatus: project.status,
        group: group
          ? {
              id: group.id,
              name: group.name,
              status: group.status,
              technologies: group.technologies ?? null,
              totalMembers: students.length,
            }
          : null,
        advisor: project.advisor
          ? {
              id: project.advisor.id,
              firstName: project.advisor.firstName,
              lastName: project.advisor.lastName,
              fullName: this.fullName(project.advisor),
              email: project.advisor.email,
              avatarUrl: project.advisor.avatarUrl ?? null,
            }
          : null,
        evaluation: {
          stage: query.stage,
          status: evaluationStatus,
          totalStudents: students.length,
          studentsEvaluated: evaluatedStudentsCount,
          studentsPendingEvaluation,
          averageScoreGiven,
          lastSavedAt: evaluation?.lastSavedAt ?? null,
          submittedAt: evaluation?.submittedAt ?? null,
        },
        milestones: milestoneSummary,
        groupMembers: students.map((student) => ({
          userId: student.id,
          firstName: student.firstName,
          lastName: student.lastName,
          fullName: this.fullName(student),
          email: student.email,
          avatarUrl: student.avatarUrl ?? null,
          evaluationStatus: (evaluation?.scores.some((score) => score.studentUserId === student.id)
            ? 'EVALUATED'
            : 'PENDING') as 'EVALUATED' | 'PENDING',
        })),
      };
    });

    return {
      stage: query.stage,
      generatedAt: new Date().toISOString(),
      summary: {
        totalAssignedProjectGroups: projectGroups.length,
        totalAssignedStudents,
        studentsEvaluated,
        studentsPendingEvaluation: Math.max(totalAssignedStudents - studentsEvaluated, 0),
        averageScoreGiven: totalScoreEntries ? Number((scoreTotal / totalScoreEntries).toFixed(2)) : 0,
        pendingProjectGroups: Math.max(projectGroups.length - completedProjectGroups, 0),
        completedProjectGroups,
        overallMilestoneProgressPercent: totalMilestones
          ? Math.floor((totalApprovedMilestones / totalMilestones) * 100)
          : 0,
      },
      projectGroups,
    };
  }

  async getEvaluatorProjectDetail(user: any, projectId: string, query: EvaluationStageQueryDto) {
    if (!user?.sub) {
      throw new ForbiddenException('Missing user context');
    }

    this.ensureSupportedStage(query.stage);

    const evaluator = await this.repository.findEvaluatorUserById(user.sub);
    if (!evaluator) {
      throw new NotFoundException('Evaluator user not found');
    }

    const detail = await this.repository.findEvaluatorProjectDetail({
      evaluatorUserId: evaluator.id,
      projectId,
      stage: query.stage,
    });

    if (!detail?.project) {
      throw new NotFoundException('Project not found for this evaluator');
    }

    const group = detail.project.proposal?.projectGroup;
    if (!group) {
      throw new BadRequestException('Project group not found for this project');
    }

    const students = this.normalizeStudents(group);
    const scoreByStudentId = new Map(
      (detail.evaluation?.scores ?? []).map((score) => [score.studentUserId, score])
    );
    const milestoneSummary = this.buildMilestoneSummary(detail.project.milestones);
    const studentsEvaluated = detail.evaluation?.scores.length ?? 0;
    const studentsPendingEvaluation = Math.max(students.length - studentsEvaluated, 0);
    const averageScoreGiven = studentsEvaluated
      ? Number(
          (
            (detail.evaluation?.scores.reduce((sum, score) => sum + score.score, 0) ?? 0) /
            studentsEvaluated
          ).toFixed(2)
        )
      : 0;

    return {
      stage: query.stage,
      generatedAt: new Date().toISOString(),
      project: {
        id: detail.project.id,
        title: detail.project.title,
        status: detail.project.status,
        createdAt: detail.project.createdAt,
      },
      advisor: detail.project.advisor
        ? {
            id: detail.project.advisor.id,
            firstName: detail.project.advisor.firstName,
            lastName: detail.project.advisor.lastName,
            fullName: this.fullName(detail.project.advisor),
            email: detail.project.advisor.email,
            avatarUrl: detail.project.advisor.avatarUrl ?? null,
          }
        : null,
      group: {
        id: group.id,
        name: group.name,
        status: group.status,
        objectives: group.objectives ?? null,
        technologies: group.technologies ?? null,
        totalMembers: students.length,
        leader: {
          id: group.leader.id,
          firstName: group.leader.firstName,
          lastName: group.leader.lastName,
          fullName: this.fullName(group.leader),
          email: group.leader.email,
          avatarUrl: group.leader.avatarUrl ?? null,
        },
      },
      evaluation: {
        stage: query.stage,
        status: this.toGroupEvaluationStatus({
          evaluatedStudents: studentsEvaluated,
          submittedAt: detail.evaluation?.submittedAt ?? null,
        }),
        totalStudents: students.length,
        studentsEvaluated,
        studentsPendingEvaluation,
        averageScoreGiven,
        lastSavedAt: detail.evaluation?.lastSavedAt ?? null,
        submittedAt: detail.evaluation?.submittedAt ?? null,
      },
      milestoneProgress: milestoneSummary,
      milestones: detail.project.milestones.map((milestone) => {
        const approvedSubmission = milestone.submissions[0] ?? null;

        const approvedSubmissionFile = approvedSubmission
          ? {
              submissionId: approvedSubmission.id,
              fileName: approvedSubmission.fileName,
              mimeType: approvedSubmission.mimeType,
              sizeBytes: approvedSubmission.sizeBytes,
              fileUrl: approvedSubmission.fileUrl,
              filePublicId: approvedSubmission.filePublicId,
              resourceType: approvedSubmission.resourceType,
              approvedAt: approvedSubmission.approvedAt,
              approvedBy: approvedSubmission.approvedBy
                ? {
                    id: approvedSubmission.approvedBy.id,
                    firstName: approvedSubmission.approvedBy.firstName,
                    lastName: approvedSubmission.approvedBy.lastName,
                    fullName: this.fullName(approvedSubmission.approvedBy),
                    email: approvedSubmission.approvedBy.email,
                    avatarUrl: approvedSubmission.approvedBy.avatarUrl ?? null,
                  }
                : null,
            }
          : null;

        return {
          id: milestone.id,
          title: milestone.title,
          description: milestone.description ?? null,
          dueDate: milestone.dueDate,
          status: milestone.status,
          submittedAt: milestone.submittedAt ?? null,
          approvedSubmission: approvedSubmissionFile,
          approvedSubmissionFile,
        };
      }),
      students: students.map((student) => {
        const evaluation = scoreByStudentId.get(student.id);

        return {
          userId: student.id,
          firstName: student.firstName,
          lastName: student.lastName,
          fullName: this.fullName(student),
          email: student.email,
          avatarUrl: student.avatarUrl ?? null,
          evaluation: {
            status: evaluation ? 'EVALUATED' : 'PENDING',
            score: evaluation?.score ?? null,
            comment: evaluation?.comment ?? null,
            savedAt: evaluation?.updatedAt ?? null,
          },
        };
      }),
    };
  }

  async saveEvaluatorProjectDraft(
    user: any,
    projectId: string,
    query: EvaluationStageQueryDto,
    body: SaveAdvisorProjectEvaluationDraftDto
  ) {
    if (!user?.sub) {
      throw new ForbiddenException('Missing user context');
    }

    this.ensureSupportedStage(query.stage);

    const evaluator = await this.repository.findEvaluatorUserById(user.sub);
    if (!evaluator) {
      throw new NotFoundException('Evaluator user not found');
    }

    const detail = await this.repository.findEvaluatorProjectDetail({
      evaluatorUserId: evaluator.id,
      projectId,
      stage: query.stage,
    });

    if (!detail?.project) {
      throw new NotFoundException('Project not found for this evaluator');
    }

    const group = detail.project.proposal?.projectGroup;
    if (!group) {
      throw new BadRequestException('Project group not found for this project');
    }

    const students = this.normalizeStudents(group);
    const validStudentIds = new Set(students.map((student) => student.id));
    const seenStudentIds = new Set<string>();

    for (const student of body.students) {
      if (seenStudentIds.has(student.studentUserId)) {
        throw new BadRequestException(`Duplicate studentUserId provided: ${student.studentUserId}`);
      }

      seenStudentIds.add(student.studentUserId);

      if (!validStudentIds.has(student.studentUserId)) {
        throw new BadRequestException(
          `Student ${student.studentUserId} does not belong to this project group`
        );
      }
    }

    let saved;
    try {
      saved = await this.repository.saveEvaluatorProjectEvaluationDraft({
        tenantId: evaluator.tenantId,
        departmentId: String(evaluator.departmentId ?? ''),
        projectId,
        evaluatorUserId: evaluator.id,
        stage: query.stage,
        students: body.students,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'SUBMITTED_EVALUATION_LOCKED') {
        throw new BadRequestException('Submitted evaluator evaluation cannot be edited');
      }

      throw error;
    }

    const totalStudents = students.length;
    const studentsEvaluated = saved?.scores.length ?? 0;
    const averageScoreGiven = studentsEvaluated
      ? Number(
          ((saved?.scores.reduce((sum, score) => sum + score.score, 0) ?? 0) / studentsEvaluated).toFixed(2)
        )
      : 0;

    return {
      message: 'Evaluator evaluation draft saved successfully',
      stage: query.stage,
      projectId,
      evaluation: {
        status: this.toGroupEvaluationStatus({
          evaluatedStudents: studentsEvaluated,
          submittedAt: saved?.submittedAt ?? null,
        }),
        totalStudents,
        studentsEvaluated,
        studentsPendingEvaluation: Math.max(totalStudents - studentsEvaluated, 0),
        averageScoreGiven,
        lastSavedAt: saved?.lastSavedAt ?? null,
        submittedAt: saved?.submittedAt ?? null,
      },
      savedStudents: body.students.map((student) => ({
        studentUserId: student.studentUserId,
        score: student.score,
        comment: student.comment?.trim() || null,
        status: 'EVALUATED',
      })),
    };
  }

  async submitEvaluatorProjectEvaluation(
    user: any,
    projectId: string,
    query: EvaluationStageQueryDto
  ) {
    if (!user?.sub) {
      throw new ForbiddenException('Missing user context');
    }

    this.ensureSupportedStage(query.stage);

    const evaluator = await this.repository.findEvaluatorUserById(user.sub);
    if (!evaluator) {
      throw new NotFoundException('Evaluator user not found');
    }

    const detail = await this.repository.findEvaluatorProjectDetail({
      evaluatorUserId: evaluator.id,
      projectId,
      stage: query.stage,
    });

    if (!detail?.project) {
      throw new NotFoundException('Project not found for this evaluator');
    }

    const group = detail.project.proposal?.projectGroup;
    if (!group) {
      throw new BadRequestException('Project group not found for this project');
    }

    const students = this.normalizeStudents(group);
    if (students.length === 0) {
      throw new BadRequestException('No students found for this project group');
    }

    const scoreByStudentId = new Map(
      (detail.evaluation?.scores ?? []).map((score) => [score.studentUserId, score])
    );
    const missingStudentIds = students
      .filter((student) => !scoreByStudentId.has(student.id))
      .map((student) => student.id);

    if (missingStudentIds.length > 0) {
      throw new BadRequestException(
        `All students must be evaluated before submit. Missing studentUserIds: ${missingStudentIds.join(', ')}`
      );
    }

    let submitted;
    try {
      submitted = await this.repository.submitEvaluatorProjectEvaluation({
        projectId,
        evaluatorUserId: evaluator.id,
        stage: query.stage,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'EVALUATION_NOT_FOUND') {
        throw new NotFoundException('Evaluator evaluation draft not found');
      }

      if (error instanceof Error && error.message === 'EVALUATION_ALREADY_SUBMITTED') {
        throw new BadRequestException('Evaluator evaluation has already been submitted');
      }

      throw error;
    }

    const totalStudents = students.length;
    const studentsEvaluated = submitted.scores.length;
    const averageScoreGiven = studentsEvaluated
      ? Number(
          ((submitted.scores.reduce((sum, score) => sum + score.score, 0) ?? 0) / studentsEvaluated).toFixed(2)
        )
      : 0;

    return {
      message: 'Evaluator evaluation submitted successfully',
      stage: query.stage,
      projectId,
      evaluation: {
        status: EvaluatorProjectEvaluationStatus.SUBMITTED,
        totalStudents,
        studentsEvaluated,
        studentsPendingEvaluation: 0,
        averageScoreGiven,
        lastSavedAt: submitted.lastSavedAt ?? null,
        submittedAt: submitted.submittedAt ?? null,
      },
      submittedStudents: submitted.scores.map((score) => ({
        studentUserId: score.studentUserId,
        score: score.score,
        comment: score.comment ?? null,
        status: 'EVALUATED',
      })),
    };
  }
}