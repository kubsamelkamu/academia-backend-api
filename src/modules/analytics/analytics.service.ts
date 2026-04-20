import { BadRequestException, Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EvaluationStage, ProjectStageFinalResultStatus, UserStatus } from '@prisma/client';
import { Workbook } from 'exceljs';
import PDFDocument from 'pdfkit';
import { AnalyticsRepository } from './analytics.repository';
import {
  AnalyticsQueryDto,
  GradesProjectsQueryDto,
  GradesStudentsQueryDto,
  GradesOverviewQueryDto,
  ProjectTrackingQueryDto,
  ReportQueryDto,
  ReportFormat,
  GradesReportScope,
  StudentDirectoryQueryDto,
} from './dto';

type GradesAggregationStatus =
  | 'WAITING_FOR_WEIGHTS'
  | 'WAITING_FOR_ADVISOR'
  | 'WAITING_FOR_EVALUATORS'
  | 'READY_FOR_AGGREGATION';

type GradesFinalizationStatus = 'NOT_FINALIZED' | ProjectStageFinalResultStatus;

type GradesProjectsDrilldownItem = {
  projectId: string;
  projectTitle: string;
  projectStatus: string;
  createdAt: Date;
  advisor: {
    userId: string;
    fullName: string | null;
    email: string;
  } | null;
  group: {
    id: string;
    name: string;
    status: string;
    totalMembers: number;
  } | null;
  aggregationStatus: GradesAggregationStatus;
  finalizationStatus: GradesFinalizationStatus;
  progress: {
    advisorSubmitted: boolean;
    assignedEvaluatorsCount: number;
    submittedEvaluatorsCount: number;
  };
  finalResult: {
    finalResultId: string;
    finalizedAt: Date;
    approvedAt: Date | null;
    rejectedAt: Date | null;
    totalStudents: number;
    averageFinalGrade: number | null;
    highestFinalGrade: number | null;
    lowestFinalGrade: number | null;
    letterGradeCounts: Record<string, number>;
  } | null;
};

type GradesStudentsDrilldownItem = {
  finalResultScoreId: string;
  finalResultId: string;
  student: {
    userId: string;
    fullName: string;
    email: string;
    status: string;
  };
  project: {
    id: string;
    title: string;
    status: string;
  };
  group: {
    id: string;
    name: string;
    status: string;
  } | null;
  finalizationStatus: ProjectStageFinalResultStatus;
  isPublished: boolean;
  weights: {
    advisorPercentage: number;
    evaluatorPercentage: number;
  };
  scores: {
    advisorScore: number;
    evaluatorAverageScore: number;
    finalGrade: number;
    letterGrade: string;
  };
  finalizedAt: Date;
  publishedAt: Date | null;
  rejectedAt: Date | null;
};

@Injectable()
export class AnalyticsService {
  constructor(private readonly analyticsRepository: AnalyticsRepository) {}

  private ensureSupportedStage(stage: EvaluationStage) {
    if (![EvaluationStage.CAPSTONE_I, EvaluationStage.CAPSTONE_II].includes(stage)) {
      throw new BadRequestException('Only CAPSTONE_I and CAPSTONE_II are supported for now');
    }
  }

  private normalizeStudents(group: {
    leader: any;
    members: Array<{ user: any }>;
  } | null) {
    if (!group) {
      return [];
    }

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

  private buildScoreBandCounts(finalGrades: number[]) {
    const scoreBands = [
      { label: '0-39.99', min: 0, max: 39.99, count: 0 },
      { label: '40-49.99', min: 40, max: 49.99, count: 0 },
      { label: '50-59.99', min: 50, max: 59.99, count: 0 },
      { label: '60-69.99', min: 60, max: 69.99, count: 0 },
      { label: '70-79.99', min: 70, max: 79.99, count: 0 },
      { label: '80-89.99', min: 80, max: 89.99, count: 0 },
      { label: '90-100', min: 90, max: 100, count: 0 },
    ];

    for (const grade of finalGrades) {
      const band = scoreBands.find((item) => grade >= item.min && grade <= item.max);
      if (band) {
        band.count += 1;
      }
    }

    return scoreBands.map(({ label, count }) => ({ label, count }));
  }

  private fullName(person: { firstName: string; lastName: string }) {
    return `${String(person.firstName ?? '').trim()} ${String(person.lastName ?? '').trim()}`.trim();
  }

  private calculateAggregationStatus(params: {
    hasWeight: boolean;
    advisorEvaluation: { status: string } | null;
    assignedEvaluatorIds: string[];
    evaluatorEvaluations: Array<{ evaluatorUserId: string; status: string }>;
  }): GradesAggregationStatus {
    const submittedEvaluators = params.evaluatorEvaluations.filter(
      (item) =>
        item.status === 'SUBMITTED' && params.assignedEvaluatorIds.includes(item.evaluatorUserId)
    );

    if (!params.hasWeight) {
      return 'WAITING_FOR_WEIGHTS';
    }

    if (!params.advisorEvaluation || params.advisorEvaluation.status !== 'SUBMITTED') {
      return 'WAITING_FOR_ADVISOR';
    }

    if (
      params.assignedEvaluatorIds.length === 0 ||
      submittedEvaluators.length < params.assignedEvaluatorIds.length
    ) {
      return 'WAITING_FOR_EVALUATORS';
    }

    return 'READY_FOR_AGGREGATION';
  }

  private calculateFinalGradeStats(finalGrades: number[]) {
    return {
      totalStudents: finalGrades.length,
      averageFinalGrade:
        finalGrades.length > 0
          ? Number((finalGrades.reduce((sum, grade) => sum + grade, 0) / finalGrades.length).toFixed(2))
          : null,
      highestFinalGrade: finalGrades.length > 0 ? Math.max(...finalGrades) : null,
      lowestFinalGrade: finalGrades.length > 0 ? Math.min(...finalGrades) : null,
    };
  }

  private buildLetterGradeCounts(letterGrades: string[]) {
    const counts = {
      'A+': 0,
      A: 0,
      'A-': 0,
      'B+': 0,
      B: 0,
      'B-': 0,
      'C+': 0,
      C: 0,
      'C-': 0,
      D: 0,
      F: 0,
    } as Record<string, number>;

    for (const grade of letterGrades) {
      if (grade in counts) {
        counts[grade] += 1;
      }
    }

    return counts;
  }

  private async buildGradesProjectsDrilldownData(
    departmentId: string,
    query: Pick<
      GradesProjectsQueryDto,
      'stage' | 'search' | 'projectStatus' | 'aggregationStatus' | 'finalizationStatus'
    >
  ) {
    const snapshot = await this.analyticsRepository.getGradesProjectDrilldownSnapshot(
      departmentId,
      query.stage
    );
    const normalizedSearch = String(query.search ?? '').trim().toLowerCase();

    const items = snapshot.projects
      .map((project) => {
        const group = project.proposal?.projectGroup ?? null;
        const students = this.normalizeStudents(group);
        const advisorEvaluation = project.advisorEvaluations[0] ?? null;
        const finalResult = project.stageFinalResults[0] ?? null;
        const assignedEvaluatorIds = Array.from(
          new Set(project.evaluators.map((item) => item.evaluatorUserId))
        );
        const submittedEvaluatorsCount = project.evaluatorEvaluations.filter(
          (item) =>
            item.status === 'SUBMITTED' && assignedEvaluatorIds.includes(item.evaluatorUserId)
        ).length;
        const aggregationStatus = this.calculateAggregationStatus({
          hasWeight: Boolean(snapshot.weight),
          advisorEvaluation,
          assignedEvaluatorIds,
          evaluatorEvaluations: project.evaluatorEvaluations,
        });
        const finalizationStatus = (finalResult?.status ?? 'NOT_FINALIZED') as GradesFinalizationStatus;
        const finalGrades = (finalResult?.scores ?? []).map((score) => score.finalGrade);
        const advisorName = project.advisor ? this.fullName(project.advisor) : null;

        const item: GradesProjectsDrilldownItem = {
          projectId: project.id,
          projectTitle: project.title,
          projectStatus: project.status,
          createdAt: project.createdAt,
          advisor: project.advisor
            ? {
                userId: project.advisor.id,
                fullName: advisorName,
                email: project.advisor.email,
              }
            : null,
          group: group
            ? {
                id: group.id,
                name: group.name,
                status: group.status,
                totalMembers: students.length,
              }
            : null,
          aggregationStatus,
          finalizationStatus,
          progress: {
            advisorSubmitted: advisorEvaluation?.status === 'SUBMITTED',
            assignedEvaluatorsCount: assignedEvaluatorIds.length,
            submittedEvaluatorsCount,
          },
          finalResult: finalResult
            ? {
                finalResultId: finalResult.id,
                finalizedAt: finalResult.finalizedAt,
                approvedAt: finalResult.approvedAt,
                rejectedAt: finalResult.rejectedAt,
                ...this.calculateFinalGradeStats(finalGrades),
                letterGradeCounts: this.buildLetterGradeCounts(
                  finalResult.scores.map((score) => score.letterGrade)
                ),
              }
            : null,
        };

        return item;
      })
      .filter((item) => {
        if (query.projectStatus && item.projectStatus !== query.projectStatus) {
          return false;
        }

        if (query.aggregationStatus && item.aggregationStatus !== query.aggregationStatus) {
          return false;
        }

        if (query.finalizationStatus && item.finalizationStatus !== query.finalizationStatus) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        return [item.projectTitle, item.group?.name, item.advisor?.fullName, item.advisor?.email]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch));
      });

    return { snapshot, items, normalizedSearch };
  }

  private async buildGradesStudentsDrilldownData(
    departmentId: string,
    query: Pick<
      GradesStudentsQueryDto,
      'stage' | 'search' | 'finalizationStatus' | 'letterGrade' | 'minFinalGrade' | 'maxFinalGrade'
    >
  ) {
    if (
      query.minFinalGrade !== undefined &&
      query.maxFinalGrade !== undefined &&
      query.minFinalGrade > query.maxFinalGrade
    ) {
      throw new BadRequestException('minFinalGrade cannot be greater than maxFinalGrade');
    }

    const snapshot = await this.analyticsRepository.getGradesStudentDrilldownSnapshot(
      departmentId,
      query.stage
    );
    const normalizedSearch = String(query.search ?? '').trim().toLowerCase();

    const items = snapshot.scores
      .map((score) => {
        const item: GradesStudentsDrilldownItem = {
          finalResultScoreId: score.id,
          finalResultId: score.finalResult.id,
          student: {
            userId: score.student.id,
            fullName: this.fullName(score.student),
            email: score.student.email,
            status: score.student.status,
          },
          project: {
            id: score.finalResult.project.id,
            title: score.finalResult.project.title,
            status: score.finalResult.project.status,
          },
          group: score.finalResult.project.proposal?.projectGroup
            ? {
                id: score.finalResult.project.proposal.projectGroup.id,
                name: score.finalResult.project.proposal.projectGroup.name,
                status: score.finalResult.project.proposal.projectGroup.status,
              }
            : null,
          finalizationStatus: score.finalResult.status,
          isPublished: score.finalResult.status === ProjectStageFinalResultStatus.APPROVED,
          weights: {
            advisorPercentage: score.finalResult.advisorPercentage,
            evaluatorPercentage: score.finalResult.evaluatorPercentage,
          },
          scores: {
            advisorScore: score.advisorScore,
            evaluatorAverageScore: score.evaluatorAverageScore,
            finalGrade: score.finalGrade,
            letterGrade: score.letterGrade,
          },
          finalizedAt: score.finalResult.finalizedAt,
          publishedAt: score.finalResult.approvedAt,
          rejectedAt: score.finalResult.rejectedAt,
        };

        return item;
      })
      .filter((item) => {
        if (query.finalizationStatus && item.finalizationStatus !== query.finalizationStatus) {
          return false;
        }

        if (query.letterGrade && item.scores.letterGrade !== query.letterGrade) {
          return false;
        }

        if (query.minFinalGrade !== undefined && item.scores.finalGrade < query.minFinalGrade) {
          return false;
        }

        if (query.maxFinalGrade !== undefined && item.scores.finalGrade > query.maxFinalGrade) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        return [item.student.fullName, item.student.email, item.project.title, item.group?.name]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch));
      });

    return { snapshot, items, normalizedSearch };
  }

  private paginateItems<T>(items: T[], page?: number, limit?: number) {
    const safePage = Math.max(page ?? 1, 1);
    const safeLimit = Math.min(Math.max(limit ?? 20, 1), 100);
    const totalItems = items.length;
    const totalPages = totalItems > 0 ? Math.ceil(totalItems / safeLimit) : 0;

    return {
      items: items.slice((safePage - 1) * safeLimit, safePage * safeLimit),
      pagination: {
        page: safePage,
        limit: safeLimit,
        totalItems,
        totalPages,
        hasNextPage: safePage < totalPages,
        hasPreviousPage: safePage > 1 && totalPages > 0,
      },
      safePage,
      safeLimit,
      totalItems,
      totalPages,
    };
  }

  private escapeCsvCell(value: unknown) {
    if (value === null || value === undefined) {
      return '';
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    const normalized =
      typeof value === 'object' ? JSON.stringify(value) : String(value);
    const escaped = normalized.replace(/"/g, '""');

    return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
  }

  private buildCsvBuffer(headers: string[], rows: unknown[][]) {
    const csv = [headers.join(','), ...rows.map((row) => row.map((cell) => this.escapeCsvCell(cell)).join(','))].join('\n');
    return Buffer.from(csv, 'utf8');
  }

  private async buildExcelBuffer(sheetName: string, headers: string[], rows: unknown[][]) {
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet(sheetName);

    worksheet.addRow(headers);
    worksheet.getRow(1).font = { bold: true };
    rows.forEach((row) => worksheet.addRow(row));
    worksheet.columns = headers.map((header, index) => {
      const maxRowWidth = rows.reduce((max, row) => {
        const cell = row[index];
        const value = cell === null || cell === undefined ? '' : String(cell);
        return Math.max(max, value.length);
      }, header.length);

      return { width: Math.min(Math.max(maxRowWidth + 2, 14), 40) };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  }

  private async generateGradesProjectsExcelReport(stage: EvaluationStage, items: GradesProjectsDrilldownItem[]) {
    const headers = [
      'Stage',
      'Project ID',
      'Project Title',
      'Project Status',
      'Group ID',
      'Group Name',
      'Group Status',
      'Total Members',
      'Advisor User ID',
      'Advisor Name',
      'Advisor Email',
      'Aggregation Status',
      'Finalization Status',
      'Advisor Submitted',
      'Assigned Evaluators',
      'Submitted Evaluators',
      'Final Result ID',
      'Finalized At',
      'Approved At',
      'Rejected At',
      'Final Result Students',
      'Average Final Grade',
      'Highest Final Grade',
      'Lowest Final Grade',
      'Letter Grade Counts',
    ];
    const rows = items.map((item) => [
      stage,
      item.projectId,
      item.projectTitle,
      item.projectStatus,
      item.group?.id ?? '',
      item.group?.name ?? '',
      item.group?.status ?? '',
      item.group?.totalMembers ?? '',
      item.advisor?.userId ?? '',
      item.advisor?.fullName ?? '',
      item.advisor?.email ?? '',
      item.aggregationStatus,
      item.finalizationStatus,
      item.progress.advisorSubmitted ? 'YES' : 'NO',
      item.progress.assignedEvaluatorsCount,
      item.progress.submittedEvaluatorsCount,
      item.finalResult?.finalResultId ?? '',
      item.finalResult?.finalizedAt?.toISOString() ?? '',
      item.finalResult?.approvedAt?.toISOString() ?? '',
      item.finalResult?.rejectedAt?.toISOString() ?? '',
      item.finalResult?.totalStudents ?? '',
      item.finalResult?.averageFinalGrade ?? '',
      item.finalResult?.highestFinalGrade ?? '',
      item.finalResult?.lowestFinalGrade ?? '',
      item.finalResult ? JSON.stringify(item.finalResult.letterGradeCounts) : '',
    ]);

    return this.buildExcelBuffer('Grades Projects', headers, rows);
  }

  private async generateGradesStudentsExcelReport(stage: EvaluationStage, items: GradesStudentsDrilldownItem[]) {
    const headers = [
      'Stage',
      'Final Result Score ID',
      'Final Result ID',
      'Student User ID',
      'Student Name',
      'Student Email',
      'Student Status',
      'Project ID',
      'Project Title',
      'Project Status',
      'Group ID',
      'Group Name',
      'Group Status',
      'Finalization Status',
      'Published',
      'Advisor Percentage',
      'Evaluator Percentage',
      'Advisor Score',
      'Evaluator Average Score',
      'Final Grade',
      'Letter Grade',
      'Finalized At',
      'Published At',
      'Rejected At',
    ];
    const rows = items.map((item) => [
      stage,
      item.finalResultScoreId,
      item.finalResultId,
      item.student.userId,
      item.student.fullName,
      item.student.email,
      item.student.status,
      item.project.id,
      item.project.title,
      item.project.status,
      item.group?.id ?? '',
      item.group?.name ?? '',
      item.group?.status ?? '',
      item.finalizationStatus,
      item.isPublished ? 'YES' : 'NO',
      item.weights.advisorPercentage,
      item.weights.evaluatorPercentage,
      item.scores.advisorScore,
      item.scores.evaluatorAverageScore,
      item.scores.finalGrade,
      item.scores.letterGrade,
      item.finalizedAt.toISOString(),
      item.publishedAt?.toISOString() ?? '',
      item.rejectedAt?.toISOString() ?? '',
    ]);

    return this.buildExcelBuffer('Grades Students', headers, rows);
  }

  private buildPdfBuffer(writeContent: (document: PDFKit.PDFDocument) => void): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const document = new PDFDocument({ margin: 48, size: 'A4' });
      const chunks: Buffer[] = [];

      document.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      document.on('end', () => resolve(Buffer.concat(chunks)));
      document.on('error', reject);

      writeContent(document);
      document.end();
    });
  }

  private writePdfSectionTitle(document: PDFKit.PDFDocument, title: string) {
    document.moveDown(0.5);
    document.font('Helvetica-Bold').fontSize(13).text(title);
    document.moveDown(0.25);
    document.font('Helvetica').fontSize(10);
  }

  private writePdfKeyValue(document: PDFKit.PDFDocument, label: string, value: unknown) {
    const rendered = value === null || value === undefined || value === '' ? 'N/A' : String(value);
    document.font('Helvetica-Bold').text(`${label}: `, { continued: true });
    document.font('Helvetica').text(rendered);
  }

  private ensurePdfPageCapacity(document: PDFKit.PDFDocument, requiredHeight = 72) {
    const pageBottom = document.page.height - document.page.margins.bottom;
    if (document.y + requiredHeight > pageBottom) {
      document.addPage();
      document.font('Helvetica').fontSize(10);
    }
  }

  private async generateGradesProjectsPdfReport(
    stage: EvaluationStage,
    departmentId: string,
    items: GradesProjectsDrilldownItem[]
  ) {
    return this.buildPdfBuffer((document) => {
      document.info.Title = `Grades Projects Report ${stage}`;
      document.font('Helvetica-Bold').fontSize(18).text('Grades Project Report');
      document.moveDown(0.5);
      document.font('Helvetica').fontSize(10);
      this.writePdfKeyValue(document, 'Stage', stage);
      this.writePdfKeyValue(document, 'Department ID', departmentId);
      this.writePdfKeyValue(document, 'Generated At', new Date().toISOString());
      this.writePdfKeyValue(document, 'Total Project Rows', items.length);

      items.forEach((item, index) => {
        this.ensurePdfPageCapacity(document, 160);
        this.writePdfSectionTitle(document, `${index + 1}. ${item.projectTitle}`);
        this.writePdfKeyValue(document, 'Project ID', item.projectId);
        this.writePdfKeyValue(document, 'Project Status', item.projectStatus);
        this.writePdfKeyValue(document, 'Aggregation Status', item.aggregationStatus);
        this.writePdfKeyValue(document, 'Finalization Status', item.finalizationStatus);
        this.writePdfKeyValue(document, 'Advisor', item.advisor?.fullName ?? 'Unassigned');
        this.writePdfKeyValue(document, 'Advisor Email', item.advisor?.email ?? 'N/A');
        this.writePdfKeyValue(document, 'Group', item.group?.name ?? 'N/A');
        this.writePdfKeyValue(document, 'Total Members', item.group?.totalMembers ?? 'N/A');
        this.writePdfKeyValue(
          document,
          'Evaluator Progress',
          `${item.progress.submittedEvaluatorsCount}/${item.progress.assignedEvaluatorsCount}`
        );
        this.writePdfKeyValue(
          document,
          'Advisor Submitted',
          item.progress.advisorSubmitted ? 'YES' : 'NO'
        );

        if (item.finalResult) {
          this.writePdfKeyValue(document, 'Final Result ID', item.finalResult.finalResultId);
          this.writePdfKeyValue(document, 'Finalized At', item.finalResult.finalizedAt.toISOString());
          this.writePdfKeyValue(document, 'Approved At', item.finalResult.approvedAt?.toISOString() ?? 'N/A');
          this.writePdfKeyValue(document, 'Rejected At', item.finalResult.rejectedAt?.toISOString() ?? 'N/A');
          this.writePdfKeyValue(document, 'Final Result Students', item.finalResult.totalStudents);
          this.writePdfKeyValue(document, 'Average Final Grade', item.finalResult.averageFinalGrade ?? 'N/A');
          this.writePdfKeyValue(document, 'Highest Final Grade', item.finalResult.highestFinalGrade ?? 'N/A');
          this.writePdfKeyValue(document, 'Lowest Final Grade', item.finalResult.lowestFinalGrade ?? 'N/A');
          this.writePdfKeyValue(
            document,
            'Letter Grade Counts',
            JSON.stringify(item.finalResult.letterGradeCounts)
          );
        } else {
          this.writePdfKeyValue(document, 'Final Result', 'Not finalized');
        }
      });
    });
  }

  private async generateGradesStudentsPdfReport(
    stage: EvaluationStage,
    departmentId: string,
    items: GradesStudentsDrilldownItem[]
  ) {
    return this.buildPdfBuffer((document) => {
      document.info.Title = `Grades Students Report ${stage}`;
      document.font('Helvetica-Bold').fontSize(18).text('Grades Student Report');
      document.moveDown(0.5);
      document.font('Helvetica').fontSize(10);
      this.writePdfKeyValue(document, 'Stage', stage);
      this.writePdfKeyValue(document, 'Department ID', departmentId);
      this.writePdfKeyValue(document, 'Generated At', new Date().toISOString());
      this.writePdfKeyValue(document, 'Total Student Rows', items.length);

      items.forEach((item, index) => {
        this.ensurePdfPageCapacity(document, 180);
        this.writePdfSectionTitle(document, `${index + 1}. ${item.student.fullName}`);
        this.writePdfKeyValue(document, 'Student User ID', item.student.userId);
        this.writePdfKeyValue(document, 'Student Email', item.student.email);
        this.writePdfKeyValue(document, 'Student Status', item.student.status);
        this.writePdfKeyValue(document, 'Project', item.project.title);
        this.writePdfKeyValue(document, 'Project ID', item.project.id);
        this.writePdfKeyValue(document, 'Project Status', item.project.status);
        this.writePdfKeyValue(document, 'Group', item.group?.name ?? 'N/A');
        this.writePdfKeyValue(document, 'Final Result ID', item.finalResultId);
        this.writePdfKeyValue(document, 'Finalization Status', item.finalizationStatus);
        this.writePdfKeyValue(document, 'Published', item.isPublished ? 'YES' : 'NO');
        this.writePdfKeyValue(document, 'Advisor Percentage', item.weights.advisorPercentage);
        this.writePdfKeyValue(document, 'Evaluator Percentage', item.weights.evaluatorPercentage);
        this.writePdfKeyValue(document, 'Advisor Score', item.scores.advisorScore);
        this.writePdfKeyValue(document, 'Evaluator Average Score', item.scores.evaluatorAverageScore);
        this.writePdfKeyValue(document, 'Final Grade', item.scores.finalGrade);
        this.writePdfKeyValue(document, 'Letter Grade', item.scores.letterGrade);
        this.writePdfKeyValue(document, 'Finalized At', item.finalizedAt.toISOString());
        this.writePdfKeyValue(document, 'Published At', item.publishedAt?.toISOString() ?? 'N/A');
        this.writePdfKeyValue(document, 'Rejected At', item.rejectedAt?.toISOString() ?? 'N/A');
      });
    });
  }

  async getGradesOverview(departmentId: string, user: any, query: GradesOverviewQueryDto) {
    this.checkDepartmentAccess(user, departmentId);
    this.ensureSupportedStage(query.stage);

    const snapshot = await this.analyticsRepository.getGradesOverviewSnapshot(departmentId, query.stage);

    const pipeline = {
      totalProjectGroups: snapshot.projects.length,
      waitingForWeightsCount: 0,
      waitingForAdvisorCount: 0,
      waitingForEvaluatorsCount: 0,
      readyForAggregationCount: 0,
      finalizedPendingApprovalCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
    };

    for (const project of snapshot.projects) {
      const students = this.normalizeStudents(project.proposal?.projectGroup ?? null);
      const advisorEvaluation = project.advisorEvaluations[0] ?? null;
      const finalResult = project.stageFinalResults[0] ?? null;
      const hasFinalResult = Boolean(finalResult);
      const assignedEvaluatorIds = Array.from(
        new Set(project.evaluators.map((item) => item.evaluatorUserId))
      );
      const submittedEvaluators = project.evaluatorEvaluations.filter(
        (item) =>
          item.status === 'SUBMITTED' && assignedEvaluatorIds.includes(item.evaluatorUserId)
      );

      let aggregationStatus:
        | 'WAITING_FOR_WEIGHTS'
        | 'WAITING_FOR_ADVISOR'
        | 'WAITING_FOR_EVALUATORS'
        | 'READY_FOR_AGGREGATION';

      if (!snapshot.weight) {
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

      const finalizationStatus = finalResult?.status ?? null;

      if (aggregationStatus === 'WAITING_FOR_WEIGHTS') pipeline.waitingForWeightsCount += 1;
      if (aggregationStatus === 'WAITING_FOR_ADVISOR') pipeline.waitingForAdvisorCount += 1;
      if (aggregationStatus === 'WAITING_FOR_EVALUATORS') pipeline.waitingForEvaluatorsCount += 1;
      if (aggregationStatus === 'READY_FOR_AGGREGATION' && !hasFinalResult) {
        pipeline.readyForAggregationCount += 1;
      }
      if (finalizationStatus === ProjectStageFinalResultStatus.FINALIZED_PENDING_DEPARTMENT_HEAD) {
        pipeline.finalizedPendingApprovalCount += 1;
      }
      if (finalizationStatus === ProjectStageFinalResultStatus.APPROVED) {
        pipeline.approvedCount += 1;
      }
      if (finalizationStatus === ProjectStageFinalResultStatus.REJECTED) {
        pipeline.rejectedCount += 1;
      }

      void students;
    }

    const finalizedScores = snapshot.finalResults.flatMap((result) => result.scores);
    const publishedScores = snapshot.finalResults
      .filter((result) => result.status === ProjectStageFinalResultStatus.APPROVED)
      .flatMap((result) => result.scores);
    const finalGrades = finalizedScores.map((score) => score.finalGrade);
    const letterGrades = {
      'A+': 0,
      A: 0,
      'A-': 0,
      'B+': 0,
      B: 0,
      'B-': 0,
      'C+': 0,
      C: 0,
      'C-': 0,
      D: 0,
      F: 0,
    } as Record<string, number>;

    for (const score of finalizedScores) {
      if (score.letterGrade in letterGrades) {
        letterGrades[score.letterGrade] += 1;
      }
    }

    const totalFinalizedProjectGroups = snapshot.finalResults.length;

    return {
      stage: query.stage,
      departmentId,
      generatedAt: new Date().toISOString(),
      weights: {
        isConfigured: Boolean(snapshot.weight),
        advisorPercentage: snapshot.weight?.advisorPercentage ?? null,
        evaluatorPercentage: snapshot.weight?.evaluatorPercentage ?? null,
        updatedAt: snapshot.weight?.updatedAt ?? null,
      },
      pipeline,
      review: {
        pendingReviewCount: pipeline.finalizedPendingApprovalCount,
        approvedCount: pipeline.approvedCount,
        rejectedCount: pipeline.rejectedCount,
        approvalRatePercent:
          totalFinalizedProjectGroups > 0
            ? Number(((pipeline.approvedCount / totalFinalizedProjectGroups) * 100).toFixed(2))
            : 0,
      },
      grades: {
        totalFinalizedStudents: finalizedScores.length,
        totalPublishedStudents: publishedScores.length,
        averageFinalGrade:
          finalGrades.length > 0
            ? Number((finalGrades.reduce((sum, grade) => sum + grade, 0) / finalGrades.length).toFixed(2))
            : 0,
        highestFinalGrade: finalGrades.length > 0 ? Math.max(...finalGrades) : null,
        lowestFinalGrade: finalGrades.length > 0 ? Math.min(...finalGrades) : null,
      },
      distributions: {
        letterGrades,
        scoreBands: this.buildScoreBandCounts(finalGrades),
      },
    };
  }

  async getGradesProjects(departmentId: string, user: any, query: GradesProjectsQueryDto) {
    this.checkDepartmentAccess(user, departmentId);
    this.ensureSupportedStage(query.stage);

    const { snapshot, items, normalizedSearch } = await this.buildGradesProjectsDrilldownData(
      departmentId,
      query
    );
    const { items: paginatedItems, pagination } = this.paginateItems(items, query.page, query.limit);
    const summary = items.reduce(
      (accumulator, item) => {
        accumulator.totalProjectGroups += 1;

        if (item.aggregationStatus === 'WAITING_FOR_WEIGHTS') accumulator.waitingForWeightsCount += 1;
        if (item.aggregationStatus === 'WAITING_FOR_ADVISOR') accumulator.waitingForAdvisorCount += 1;
        if (item.aggregationStatus === 'WAITING_FOR_EVALUATORS') accumulator.waitingForEvaluatorsCount += 1;
        if (item.aggregationStatus === 'READY_FOR_AGGREGATION' && item.finalizationStatus === 'NOT_FINALIZED') {
          accumulator.readyForAggregationCount += 1;
        }
        if (item.finalizationStatus === 'NOT_FINALIZED') accumulator.notFinalizedCount += 1;
        if (item.finalizationStatus === ProjectStageFinalResultStatus.FINALIZED_PENDING_DEPARTMENT_HEAD) {
          accumulator.finalizedPendingApprovalCount += 1;
        }
        if (item.finalizationStatus === ProjectStageFinalResultStatus.APPROVED) {
          accumulator.approvedCount += 1;
        }
        if (item.finalizationStatus === ProjectStageFinalResultStatus.REJECTED) {
          accumulator.rejectedCount += 1;
        }

        return accumulator;
      },
      {
        totalProjectGroups: 0,
        waitingForWeightsCount: 0,
        waitingForAdvisorCount: 0,
        waitingForEvaluatorsCount: 0,
        readyForAggregationCount: 0,
        notFinalizedCount: 0,
        finalizedPendingApprovalCount: 0,
        approvedCount: 0,
        rejectedCount: 0,
      }
    );

    return {
      stage: query.stage,
      departmentId,
      generatedAt: new Date().toISOString(),
      weights: {
        isConfigured: Boolean(snapshot.weight),
        advisorPercentage: snapshot.weight?.advisorPercentage ?? null,
        evaluatorPercentage: snapshot.weight?.evaluatorPercentage ?? null,
        updatedAt: snapshot.weight?.updatedAt ?? null,
      },
      summary,
      pagination,
      filters: {
        search: normalizedSearch || null,
        projectStatus: query.projectStatus ?? null,
        aggregationStatus: query.aggregationStatus ?? null,
        finalizationStatus: query.finalizationStatus ?? null,
      },
      items: paginatedItems,
    };
  }

  async getGradesStudents(departmentId: string, user: any, query: GradesStudentsQueryDto) {
    this.checkDepartmentAccess(user, departmentId);
    this.ensureSupportedStage(query.stage);

    const { items, normalizedSearch } = await this.buildGradesStudentsDrilldownData(
      departmentId,
      query
    );
    const { items: paginatedItems, pagination, totalItems } = this.paginateItems(
      items,
      query.page,
      query.limit
    );
    const finalGrades = items.map((item) => item.scores.finalGrade);

    return {
      stage: query.stage,
      departmentId,
      generatedAt: new Date().toISOString(),
      summary: {
        approvedCount: items.filter(
          (item) => item.finalizationStatus === ProjectStageFinalResultStatus.APPROVED
        ).length,
        pendingApprovalCount: items.filter(
          (item) =>
            item.finalizationStatus === ProjectStageFinalResultStatus.FINALIZED_PENDING_DEPARTMENT_HEAD
        ).length,
        rejectedCount: items.filter(
          (item) => item.finalizationStatus === ProjectStageFinalResultStatus.REJECTED
        ).length,
        ...this.calculateFinalGradeStats(finalGrades),
        letterGradeCounts: this.buildLetterGradeCounts(
          items.map((item) => item.scores.letterGrade)
        ),
      },
      pagination,
      filters: {
        search: normalizedSearch || null,
        finalizationStatus: query.finalizationStatus ?? null,
        letterGrade: query.letterGrade ?? null,
        minFinalGrade: query.minFinalGrade ?? null,
        maxFinalGrade: query.maxFinalGrade ?? null,
      },
      items: paginatedItems,
    };
  }

  // Department Overview
  async getDepartmentOverview(departmentId: string, user: any, query: AnalyticsQueryDto) {
    this.checkDepartmentAccess(user, departmentId);

    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;

    return this.analyticsRepository.getDepartmentOverview(departmentId, startDate, endDate);
  }

  // Project Summary
  async getProjectSummary(departmentId: string, user: any, query: AnalyticsQueryDto) {
    this.checkDepartmentAccess(user, departmentId);

    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;

    return this.analyticsRepository.getProjectSummary(departmentId, startDate, endDate);
  }

  async getProjectTracking(
    departmentId: string,
    user: any,
    query: ProjectTrackingQueryDto
  ) {
    this.checkDepartmentAccess(user, departmentId);

    return this.analyticsRepository.getProjectTracking({
      departmentId,
      search: query.search,
      projectStatus: query.projectStatus,
      page: query.page,
      limit: query.limit,
    });
  }

  // Advisor Performance
  async getAdvisorPerformance(departmentId: string, user: any, query: AnalyticsQueryDto) {
    this.checkDepartmentAccess(user, departmentId);

    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;

    return this.analyticsRepository.getAdvisorPerformance(departmentId, startDate, endDate);
  }

  async getAdvisorOverview(departmentId: string, user: any, query: AnalyticsQueryDto) {
    this.checkDepartmentAccess(user, departmentId);

    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;

    return this.analyticsRepository.getAdvisorOverviewDetailed(departmentId, {
      startDate,
      endDate,
      search: query.search,
      page: query.page,
      limit: query.limit,
      projectStatus: query.projectStatus,
    });
  }

  async getAdvisorDetail(
    departmentId: string,
    advisorId: string,
    user: any,
    query: AnalyticsQueryDto
  ) {
    this.checkDepartmentAccess(user, departmentId);

    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;

    const detail = await this.analyticsRepository.getAdvisorDetail(
      departmentId,
      advisorId,
      {
        startDate,
        endDate,
        projectStatus: query.projectStatus,
      }
    );

    if (!detail) {
      throw new NotFoundException('Advisor not found in this department');
    }

    return detail;
  }

  // Student Progress
  async getStudentProgress(departmentId: string, user: any, query: AnalyticsQueryDto) {
    this.checkDepartmentAccess(user, departmentId);

    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;

    return this.analyticsRepository.getStudentProgress(departmentId, startDate, endDate);
  }

  async getStudentDirectory(departmentId: string, user: any, query: StudentDirectoryQueryDto) {
    this.checkDepartmentAccess(user, departmentId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    return this.analyticsRepository.getStudentDirectory({
      departmentId,
      page,
      limit,
      search: query.search,
      userStatus: query.userStatus,
      groupStatus: query.groupStatus,
      hasGroup: query.hasGroup,
    });
  }

  // Report Generation
  async generateProjectReport(departmentId: string, user: any, query: ReportQueryDto) {
    this.checkDepartmentAccess(user, departmentId);

    const data = await this.analyticsRepository.getProjectReportData(departmentId, query);

    switch (query.format) {
      case ReportFormat.CSV:
        return this.generateCSVReport(data);
      case ReportFormat.PDF:
        return this.generatePDFReport(data);
      case ReportFormat.EXCEL:
        return this.generateExcelReport(data);
      default:
        throw new Error('Unsupported format');
    }
  }

  async generateComplianceReport(departmentId: string, user: any, query: ReportQueryDto) {
    this.checkDepartmentAccess(user, departmentId);

    const startDate = query.startDate ? new Date(query.startDate) : undefined;
    const endDate = query.endDate ? new Date(query.endDate) : undefined;

    const data = await this.analyticsRepository.getComplianceReportData(
      departmentId,
      startDate,
      endDate
    );

    switch (query.format) {
      case ReportFormat.CSV:
        return this.generateComplianceCSV(data);
      case ReportFormat.PDF:
        return this.generateCompliancePDF(data);
      default:
        throw new Error('Unsupported format');
    }
  }

  async generateGradesReport(departmentId: string, user: any, query: ReportQueryDto) {
    this.checkDepartmentAccess(user, departmentId);

    if (!query.stage) {
      throw new BadRequestException('stage is required for grades reports');
    }

    this.ensureSupportedStage(query.stage);

    const scope = query.scope ?? GradesReportScope.PROJECTS;

    if (scope === GradesReportScope.PROJECTS) {
      const { items } = await this.buildGradesProjectsDrilldownData(departmentId, {
        stage: query.stage,
        search: query.search,
        projectStatus: query.projectStatus,
        aggregationStatus: query.aggregationStatus,
        finalizationStatus: query.finalizationStatus,
      });

      if (query.format === ReportFormat.CSV) {
        const headers = [
          'Stage',
          'Project ID',
          'Project Title',
          'Project Status',
          'Group ID',
          'Group Name',
          'Group Status',
          'Total Members',
          'Advisor User ID',
          'Advisor Name',
          'Advisor Email',
          'Aggregation Status',
          'Finalization Status',
          'Advisor Submitted',
          'Assigned Evaluators',
          'Submitted Evaluators',
          'Final Result ID',
          'Finalized At',
          'Approved At',
          'Rejected At',
          'Final Result Students',
          'Average Final Grade',
          'Highest Final Grade',
          'Lowest Final Grade',
          'Letter Grade Counts',
        ];
        const rows = items.map((item) => [
          query.stage,
          item.projectId,
          item.projectTitle,
          item.projectStatus,
          item.group?.id ?? '',
          item.group?.name ?? '',
          item.group?.status ?? '',
          item.group?.totalMembers ?? '',
          item.advisor?.userId ?? '',
          item.advisor?.fullName ?? '',
          item.advisor?.email ?? '',
          item.aggregationStatus,
          item.finalizationStatus,
          item.progress.advisorSubmitted ? 'YES' : 'NO',
          item.progress.assignedEvaluatorsCount,
          item.progress.submittedEvaluatorsCount,
          item.finalResult?.finalResultId ?? '',
          item.finalResult?.finalizedAt?.toISOString() ?? '',
          item.finalResult?.approvedAt?.toISOString() ?? '',
          item.finalResult?.rejectedAt?.toISOString() ?? '',
          item.finalResult?.totalStudents ?? '',
          item.finalResult?.averageFinalGrade ?? '',
          item.finalResult?.highestFinalGrade ?? '',
          item.finalResult?.lowestFinalGrade ?? '',
          item.finalResult ? JSON.stringify(item.finalResult.letterGradeCounts) : '',
        ]);

        return this.buildCsvBuffer(headers, rows);
      }

      if (query.format === ReportFormat.EXCEL) {
        return this.generateGradesProjectsExcelReport(query.stage, items);
      }

      if (query.format === ReportFormat.PDF) {
        return this.generateGradesProjectsPdfReport(query.stage, departmentId, items);
      }

      throw new BadRequestException('Grades reports currently support only csv, excel, and pdf formats');
    }

    const { items } = await this.buildGradesStudentsDrilldownData(departmentId, {
      stage: query.stage,
      search: query.search,
      finalizationStatus:
        query.finalizationStatus === 'NOT_FINALIZED' ? undefined : query.finalizationStatus,
      letterGrade: query.letterGrade,
      minFinalGrade: query.minFinalGrade,
      maxFinalGrade: query.maxFinalGrade,
    });

    if (query.format === ReportFormat.CSV) {
      const headers = [
        'Stage',
        'Final Result Score ID',
        'Final Result ID',
        'Student User ID',
        'Student Name',
        'Student Email',
        'Student Status',
        'Project ID',
        'Project Title',
        'Project Status',
        'Group ID',
        'Group Name',
        'Group Status',
        'Finalization Status',
        'Published',
        'Advisor Percentage',
        'Evaluator Percentage',
        'Advisor Score',
        'Evaluator Average Score',
        'Final Grade',
        'Letter Grade',
        'Finalized At',
        'Published At',
        'Rejected At',
      ];
      const rows = items.map((item) => [
        query.stage,
        item.finalResultScoreId,
        item.finalResultId,
        item.student.userId,
        item.student.fullName,
        item.student.email,
        item.student.status,
        item.project.id,
        item.project.title,
        item.project.status,
        item.group?.id ?? '',
        item.group?.name ?? '',
        item.group?.status ?? '',
        item.finalizationStatus,
        item.isPublished ? 'YES' : 'NO',
        item.weights.advisorPercentage,
        item.weights.evaluatorPercentage,
        item.scores.advisorScore,
        item.scores.evaluatorAverageScore,
        item.scores.finalGrade,
        item.scores.letterGrade,
        item.finalizedAt.toISOString(),
        item.publishedAt?.toISOString() ?? '',
        item.rejectedAt?.toISOString() ?? '',
      ]);

      return this.buildCsvBuffer(headers, rows);
    }

    if (query.format === ReportFormat.EXCEL) {
      return this.generateGradesStudentsExcelReport(query.stage, items);
    }

    if (query.format === ReportFormat.PDF) {
      return this.generateGradesStudentsPdfReport(query.stage, departmentId, items);
    }

    throw new BadRequestException('Grades reports currently support only csv, excel, and pdf formats');
  }

  private checkDepartmentAccess(user: any, departmentId: string) {
    const hasAccess =
      user.departmentId === departmentId ||
      user.roles.includes('PLATFORM_ADMIN') ||
      user.roles.includes('DEPARTMENT_HEAD');

    if (!hasAccess) {
      throw new ForbiddenException('Access denied to this department');
    }
  }

  // Report generation methods (simplified implementations)
  private generateCSVReport(data: any[]): Buffer {
    const csvHeader =
      'Project ID,Title,Status,Advisor,Students,Created Date,Milestones Completed\n';
    const csvRows = data
      .map((project) => {
        const students = project.members
          .filter((m: any) => m.role === 'STUDENT')
          .map((m: any) => `${m.user.firstName} ${m.user.lastName}`)
          .join('; ');

        const completedMilestones = project.milestones.filter(
          (m: any) => m.status === 'APPROVED'
        ).length;
        const totalMilestones = project.milestones.length;
        const advisorName = project.advisor
          ? `${project.advisor.firstName} ${project.advisor.lastName}`.trim()
          : 'Unassigned';

        return `${project.id},${project.title},${project.status},${advisorName},"${students}",${project.createdAt.toISOString()},${completedMilestones}/${totalMilestones}`;
      })
      .join('\n');

    return Buffer.from(csvHeader + csvRows);
  }

  private generatePDFReport(data: any[]): Buffer {
    // Simplified PDF generation - in real implementation, use pdfkit or puppeteer
    const content = `
Academic Projects Report
Generated: ${new Date().toISOString()}

Total Projects: ${data.length}

${data
  .map(
    (project, index) => `
${index + 1}. ${project.title}
   Status: ${project.status}
   Advisor: ${project.advisor ? `${project.advisor.firstName} ${project.advisor.lastName}`.trim() : 'Unassigned'}
   Students: ${project.members.filter((m: any) => m.role === 'STUDENT').length}
   Created: ${project.createdAt.toISOString().split('T')[0]}
   Milestones: ${project.milestones.filter((m: any) => m.status === 'APPROVED').length}/${project.milestones.length}
`
  )
  .join('\n')}
    `;

    return Buffer.from(content);
  }

  private generateExcelReport(data: any[]): Buffer {
    // Simplified Excel generation - in real implementation, use exceljs
    const csvData = this.generateCSVReport(data);
    return csvData; // Placeholder - would convert to Excel format
  }

  private generateComplianceCSV(data: any): Buffer {
    const csvHeader = 'Metric,Value,Status\n';

    const rows = [
      `Total Projects,${data.projectApprovals.length},N/A`,
      `Advisor Compliance,${data.advisorWorkloadCompliance.filter((a: any) => a.compliance).length}/${data.advisorWorkloadCompliance.length},${data.advisorWorkloadCompliance.every((a: any) => a.compliance) ? 'PASS' : 'FAIL'}`,
      `Total Milestones,${data.milestoneStats.total_milestones},N/A`,
      `Completed Milestones,${data.milestoneStats.completed_milestones},N/A`,
      `Overdue Milestones,${data.milestoneStats.overdue_milestones},${data.milestoneStats.overdue_milestones > 0 ? 'WARNING' : 'OK'}`,
    ];

    return Buffer.from(csvHeader + rows.join('\n'));
  }

  private generateCompliancePDF(data: any): Buffer {
    const content = `
Compliance Report
Generated: ${new Date().toISOString()}

Project Approvals: ${data.projectApprovals.length} projects
Advisor Workload Compliance: ${data.advisorWorkloadCompliance.filter((a: any) => a.compliance).length}/${data.advisorWorkloadCompliance.length} compliant
Milestone Completion: ${data.milestoneStats.completed_milestones}/${data.milestoneStats.total_milestones}
Overdue Milestones: ${data.milestoneStats.overdue_milestones}
    `;

    return Buffer.from(content);
  }
}
