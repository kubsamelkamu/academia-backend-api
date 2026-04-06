import { Controller, Get, Query, Param, UseGuards, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiOkResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { AnalyticsService } from './analytics.service';
import {
  AnalyticsQueryDto,
  AdvisorDetailResponseDto,
  AdvisorOverviewResponseDto,
  ReportQueryDto,
  StudentDirectoryQueryDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { ROLES } from '../../common/constants/roles.constants';

@ApiTags('Analytics & Reports')
@Controller({ path: 'analytics', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('access-token')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('department/overview')
  @Roles(ROLES.DEPARTMENT_HEAD, ROLES.COORDINATOR)
  @ApiOperation({ summary: 'Get department overview metrics' })
  @ApiResponse({ status: 200, description: 'Department overview metrics retrieved' })
  async getDepartmentOverview(@Query() query: AnalyticsQueryDto, @GetUser() user: any) {
    const departmentId = query.departmentId || user.departmentId;
    return this.analyticsService.getDepartmentOverview(departmentId, user, query);
  }

  @Get('projects/summary')
  @Roles(ROLES.DEPARTMENT_HEAD, ROLES.COORDINATOR)
  @ApiOperation({ summary: 'Get project completion statistics' })
  @ApiResponse({ status: 200, description: 'Project summary statistics retrieved' })
  async getProjectSummary(@Query() query: AnalyticsQueryDto, @GetUser() user: any) {
    const departmentId = query.departmentId || user.departmentId;
    return this.analyticsService.getProjectSummary(departmentId, user, query);
  }

  @Get('advisors/performance')
  @Roles(ROLES.DEPARTMENT_HEAD, ROLES.COORDINATOR)
  @ApiOperation({ summary: 'Get advisor performance metrics' })
  @ApiResponse({ status: 200, description: 'Advisor performance metrics retrieved' })
  async getAdvisorPerformance(@Query() query: AnalyticsQueryDto, @GetUser() user: any) {
    const departmentId = query.departmentId || user.departmentId;
    return this.analyticsService.getAdvisorPerformance(departmentId, user, query);
  }

  @Get('advisors/overview')
  @Roles(ROLES.DEPARTMENT_HEAD, ROLES.COORDINATOR)
  @ApiOperation({
    summary:
      'Get department advisor overview with advisor profiles, advised projects, milestone progress, and group members',
  })
  @ApiOkResponse({ type: AdvisorOverviewResponseDto, description: 'Advisor overview retrieved successfully' })
  async getAdvisorOverview(@Query() query: AnalyticsQueryDto, @GetUser() user: any) {
    const departmentId = query.departmentId || user.departmentId;
    return this.analyticsService.getAdvisorOverview(departmentId, user, query);
  }

  @Get('advisors/:advisorId')
  @Roles(ROLES.DEPARTMENT_HEAD, ROLES.COORDINATOR)
  @ApiOperation({
    summary:
      'Get detailed analytics for one advisor with advised projects, milestone progress, and group members',
  })
  @ApiOkResponse({ type: AdvisorDetailResponseDto, description: 'Advisor detail retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Advisor not found in this department' })
  async getAdvisorDetail(
    @Param('advisorId') advisorId: string,
    @Query() query: AnalyticsQueryDto,
    @GetUser() user: any
  ) {
    const departmentId = query.departmentId || user.departmentId;
    return this.analyticsService.getAdvisorDetail(departmentId, advisorId, user, query);
  }

  @Get('students/progress')
  @Roles(ROLES.DEPARTMENT_HEAD, ROLES.COORDINATOR)
  @ApiOperation({ summary: 'Get student progress tracking' })
  @ApiResponse({ status: 200, description: 'Student progress metrics retrieved' })
  async getStudentProgress(@Query() query: AnalyticsQueryDto, @GetUser() user: any) {
    const departmentId = query.departmentId || user.departmentId;
    return this.analyticsService.getStudentProgress(departmentId, user, query);
  }

  @Get('students/directory')
  @Roles(ROLES.DEPARTMENT_HEAD, ROLES.COORDINATOR)
  @ApiOperation({
    summary:
      'Get paginated department student directory with student profile, project group, group role, and summary counts',
  })
  @ApiResponse({ status: 200, description: 'Student directory retrieved successfully' })
  async getStudentDirectory(@Query() query: StudentDirectoryQueryDto, @GetUser() user: any) {
    const departmentId = query.departmentId || user.departmentId;
    return this.analyticsService.getStudentDirectory(departmentId, user, query);
  }
}

@ApiTags('Reports')
@Controller({ path: 'reports', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('access-token')
export class ReportsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('projects/:format')
  @Roles(ROLES.DEPARTMENT_HEAD, ROLES.COORDINATOR)
  @ApiOperation({ summary: 'Generate project report (PDF/CSV/Excel)' })
  @ApiResponse({ status: 200, description: 'Report generated successfully' })
  async generateProjectReport(
    @Param('format') format: string,
    @Query() query: ReportQueryDto,
    @GetUser() user: any,
    @Res() res: Response
  ) {
    const departmentId = query.departmentId || user.departmentId;
    query.format = format as any;

    const reportBuffer = await this.analyticsService.generateProjectReport(
      departmentId,
      user,
      query
    );

    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      csv: 'text/csv',
      excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };

    res.setHeader('Content-Type', mimeTypes[format] || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename=projects-report.${format}`);
    res.send(reportBuffer);
  }

  @Get('grades/:format')
  @Roles(ROLES.DEPARTMENT_HEAD, ROLES.COORDINATOR)
  @ApiOperation({ summary: 'Generate grading report' })
  @ApiResponse({ status: 200, description: 'Grades report generated' })
  @ApiResponse({ status: 501, description: 'Not implemented - requires evaluation system' })
  async generateGradesReport(
    @Param('format') format: string,
    @Query() query: ReportQueryDto,
    @GetUser() user: any,
    @Res() res: Response
  ) {
    const departmentId = query.departmentId || user.departmentId;
    query.format = format as any;

    const reportBuffer = await this.analyticsService.generateGradesReport(
      departmentId,
      user,
      query
    );

    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      csv: 'text/csv',
      excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };

    res.setHeader('Content-Type', mimeTypes[format] || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename=grades-report.${format}`);
    res.send(reportBuffer);
  }

  @Get('compliance/:format')
  @Roles(ROLES.DEPARTMENT_HEAD, ROLES.COORDINATOR)
  @ApiOperation({ summary: 'Generate compliance report' })
  @ApiResponse({ status: 200, description: 'Compliance report generated' })
  async generateComplianceReport(
    @Param('format') format: string,
    @Query() query: ReportQueryDto,
    @GetUser() user: any,
    @Res() res: Response
  ) {
    const departmentId = query.departmentId || user.departmentId;
    query.format = format as any;

    const reportBuffer = await this.analyticsService.generateComplianceReport(
      departmentId,
      user,
      query
    );

    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      csv: 'text/csv',
    };

    res.setHeader('Content-Type', mimeTypes[format] || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename=compliance-report.${format}`);
    res.send(reportBuffer);
  }
}
