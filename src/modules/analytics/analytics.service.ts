import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AnalyticsRepository } from './analytics.repository';
import {
  AnalyticsQueryDto,
  ProjectTrackingQueryDto,
  ReportQueryDto,
  ReportFormat,
  StudentDirectoryQueryDto,
} from './dto';

@Injectable()
export class AnalyticsService {
  constructor(private readonly analyticsRepository: AnalyticsRepository) {}

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

  async getProjectTracking(departmentId: string, user: any, query: ProjectTrackingQueryDto) {
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

    const detail = await this.analyticsRepository.getAdvisorDetail(departmentId, advisorId, {
      startDate,
      endDate,
      projectStatus: query.projectStatus,
    });

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

  // Placeholder for grades report (would need evaluation/grading system)
  async generateGradesReport(departmentId: string, user: any, _query: ReportQueryDto) {
    this.checkDepartmentAccess(user, departmentId);

    // This would require an evaluation/grading system to be implemented
    // For now, return a placeholder
    throw new Error('Grades report not yet implemented - requires evaluation system');
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
