import {
  AdvisorProjectEvaluationStatus,
  EvaluationStage,
  MilestoneStatus,
  UserStatus,
} from '@prisma/client';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AdvisorProjectEvaluationRepository } from './advisor-project-evaluation.repository';
import {
  EvaluationStageQueryDto,
  SaveAdvisorProjectEvaluationDraftDto,
} from './dto';

@Injectable()
export class AdvisorProjectEvaluationService {
  constructor(private readonly repository: AdvisorProjectEvaluationRepository) {}

  private ensureSupportedStage(stage: EvaluationStage) {
    if (![EvaluationStage.CAPSTONE_I, EvaluationStage.CAPSTONE_II].includes(stage)) {
      throw new BadRequestException('Only CAPSTONE_I and CAPSTONE_II are supported for now');
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
    const candidateStudents = [group.leader, ...group.members.map((member) => member.user)];

    for (const student of candidateStudents) {
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
    totalStudents: number;
    evaluatedStudents: number;
    submittedAt: Date | null;
  }) {
    if (params.submittedAt) {
      return AdvisorProjectEvaluationStatus.SUBMITTED;
    }

    if (params.evaluatedStudents === 0) {
      return AdvisorProjectEvaluationStatus.NOT_STARTED;
    }

    return AdvisorProjectEvaluationStatus.IN_PROGRESS;
  }

  async getAdvisorDashboard(user: any, query: EvaluationStageQueryDto) {
    if (!user?.sub) {
      throw new ForbiddenException('Missing user context');
    }

    this.ensureSupportedStage(query.stage);

    const advisor = await this.repository.findAdvisorByUserId(user.sub);
    if (!advisor) {
      throw new NotFoundException('Advisor profile not found');
    }

    const projects = await this.repository.listAdvisorProjectsDashboard(advisor.userId);
    const evaluations = await this.repository.listAdvisorEvaluationsForProjects({
      advisorUserId: advisor.userId,
      stage: query.stage,
      projectIds: projects.map((project) => project.id),
    });

    const evaluationByProjectId = new Map(evaluations.map((evaluation) => [evaluation.projectId, evaluation]));

    let totalStudents = 0;
    let studentsEvaluated = 0;
    let totalApprovedMilestones = 0;
    let totalMilestones = 0;
    let fullyEvaluatedProjectGroups = 0;

    const projectGroups = projects.map((project) => {
      const group = project.proposal?.projectGroup;
      const students = group ? this.normalizeStudents(group) : [];
      const evaluation = evaluationByProjectId.get(project.id);
      const milestoneSummary = this.buildMilestoneSummary(project.milestones);
      const evaluatedStudents = evaluation?.scores.length ?? 0;
      const pendingStudents = Math.max(students.length - evaluatedStudents, 0);
      const groupEvaluationStatus = this.toGroupEvaluationStatus({
        totalStudents: students.length,
        evaluatedStudents,
        submittedAt: evaluation?.submittedAt ?? null,
      });

      totalStudents += students.length;
      studentsEvaluated += evaluatedStudents;
      totalApprovedMilestones += milestoneSummary.approved;
      totalMilestones += milestoneSummary.total;

      if (pendingStudents === 0 && students.length > 0) {
        fullyEvaluatedProjectGroups += 1;
      }

      return {
        projectId: project.id,
        projectTitle: project.title,
        projectStatus: project.status,
        group: group
          ? {
              id: group.id,
              name: group.name,
              status: group.status,
              totalMembers: students.length,
            }
          : null,
        evaluation: {
          stage: query.stage,
          status: groupEvaluationStatus,
          totalStudents: students.length,
          studentsEvaluated: evaluatedStudents,
          studentsPendingEvaluation: pendingStudents,
          lastSavedAt: evaluation?.lastSavedAt ?? null,
          submittedAt: evaluation?.submittedAt ?? null,
        },
        milestones: milestoneSummary,
        nextAction:
          groupEvaluationStatus === AdvisorProjectEvaluationStatus.SUBMITTED
            ? 'VIEW_SUBMITTED_EVALUATION'
            : groupEvaluationStatus === AdvisorProjectEvaluationStatus.NOT_STARTED
              ? 'START_EVALUATION'
              : 'COMPLETE_STUDENT_EVALUATION',
      };
    });

    return {
      stage: query.stage,
      generatedAt: new Date().toISOString(),
      summary: {
        totalProjectGroups: projectGroups.length,
        totalStudents,
        studentsEvaluated,
        studentsPendingEvaluation: Math.max(totalStudents - studentsEvaluated, 0),
        overallMilestoneProgressPercent: totalMilestones
          ? Math.floor((totalApprovedMilestones / totalMilestones) * 100)
          : 0,
        fullyEvaluatedProjectGroups,
        projectGroupsPendingEvaluation: Math.max(projectGroups.length - fullyEvaluatedProjectGroups, 0),
      },
      projectGroups,
    };
  }

  async getAdvisorProjectDetail(user: any, projectId: string, query: EvaluationStageQueryDto) {
    if (!user?.sub) {
      throw new ForbiddenException('Missing user context');
    }

    this.ensureSupportedStage(query.stage);

    const advisor = await this.repository.findAdvisorByUserId(user.sub);
    if (!advisor) {
      throw new NotFoundException('Advisor profile not found');
    }

    const detail = await this.repository.findAdvisorProjectDetail({
      advisorUserId: advisor.userId,
      projectId,
      stage: query.stage,
    });

    if (!detail?.project) {
      throw new NotFoundException('Project not found for this advisor');
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

    return {
      stage: query.stage,
      generatedAt: new Date().toISOString(),
      project: {
        id: detail.project.id,
        title: detail.project.title,
        status: detail.project.status,
        createdAt: detail.project.createdAt,
      },
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
          totalStudents: students.length,
          evaluatedStudents: studentsEvaluated,
          submittedAt: detail.evaluation?.submittedAt ?? null,
        }),
        totalStudents: students.length,
        studentsEvaluated,
        studentsPendingEvaluation,
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
          status: student.status,
          studentProfile: student.student
            ? {
                id: student.student.id,
                bio: student.student.bio ?? null,
                githubUrl: student.student.githubUrl ?? null,
                linkedinUrl: student.student.linkedinUrl ?? null,
                portfolioUrl: student.student.portfolioUrl ?? null,
                techStack: student.student.techStack ?? null,
              }
            : null,
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

  async saveAdvisorProjectDraft(
    user: any,
    projectId: string,
    query: EvaluationStageQueryDto,
    body: SaveAdvisorProjectEvaluationDraftDto
  ) {
    if (!user?.sub) {
      throw new ForbiddenException('Missing user context');
    }

    this.ensureSupportedStage(query.stage);

    const advisor = await this.repository.findAdvisorByUserId(user.sub);
    if (!advisor) {
      throw new NotFoundException('Advisor profile not found');
    }

    const detail = await this.repository.findAdvisorProjectDetail({
      advisorUserId: advisor.userId,
      projectId,
      stage: query.stage,
    });

    if (!detail?.project) {
      throw new NotFoundException('Project not found for this advisor');
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
      saved = await this.repository.saveAdvisorProjectEvaluationDraft({
        tenantId: advisor.user.tenantId,
        departmentId: advisor.departmentId,
        projectId,
        advisorUserId: advisor.userId,
        stage: query.stage,
        students: body.students,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'SUBMITTED_EVALUATION_LOCKED') {
        throw new BadRequestException('Submitted advisor evaluation cannot be edited');
      }

      throw error;
    }

    const totalStudents = students.length;
    const studentsEvaluated = saved?.scores.length ?? 0;

    return {
      message: 'Advisor evaluation draft saved successfully',
      stage: query.stage,
      projectId,
      evaluation: {
        status: this.toGroupEvaluationStatus({
          totalStudents,
          evaluatedStudents: studentsEvaluated,
          submittedAt: saved?.submittedAt ?? null,
        }),
        totalStudents,
        studentsEvaluated,
        studentsPendingEvaluation: Math.max(totalStudents - studentsEvaluated, 0),
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

  async submitAdvisorProjectEvaluation(user: any, projectId: string, query: EvaluationStageQueryDto) {
    if (!user?.sub) {
      throw new ForbiddenException('Missing user context');
    }

    this.ensureSupportedStage(query.stage);

    const advisor = await this.repository.findAdvisorByUserId(user.sub);
    if (!advisor) {
      throw new NotFoundException('Advisor profile not found');
    }

    const detail = await this.repository.findAdvisorProjectDetail({
      advisorUserId: advisor.userId,
      projectId,
      stage: query.stage,
    });

    if (!detail?.project) {
      throw new NotFoundException('Project not found for this advisor');
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
      submitted = await this.repository.submitAdvisorProjectEvaluation({
        projectId,
        advisorUserId: advisor.userId,
        stage: query.stage,
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'EVALUATION_NOT_FOUND') {
        throw new NotFoundException('Advisor evaluation draft not found');
      }

      throw error;
    }

    const totalStudents = students.length;
    const studentsEvaluated = submitted.scores.length;

    return {
      message: 'Advisor project evaluation submitted successfully.',
      stage: query.stage,
      projectId,
      evaluation: {
        status: AdvisorProjectEvaluationStatus.SUBMITTED,
        totalStudents,
        studentsEvaluated,
        studentsPendingEvaluation: Math.max(totalStudents - studentsEvaluated, 0),
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