import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';

import { ROLES } from '../../common/constants/roles.constants';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdvisorService } from './advisor.service';
import { ClearProjectDto } from './dto/clear-project.dto';
import { CreateAdvisorAnnouncementDto } from './dto/create-advisor-announcement.dto';
import { CreateAdvisorMessageDto } from './dto/create-advisor-message.dto';
import { CreateAdvisorMessageGroupDto } from './dto/create-advisor-message-group.dto';
import { CreateProjectDocumentDto } from './dto/create-project-document.dto';
import { CreateProjectMeetingDto } from './dto/create-project-meeting.dto';
import { CreateProjectRevisionRequestDto } from './dto/create-project-revision-request.dto';
import { ReviewProjectDocumentDto } from './dto/review-project-document.dto';
import { UpdateProjectEvaluationDto } from './dto/update-project-evaluation.dto';
import { UpdateProjectMeetingDto } from './dto/update-project-meeting.dto';

const DOCUMENT_MIMES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/webm',
  'application/zip',
  'application/x-zip-compressed',
]);

const ANNOUNCEMENT_MIMES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const fileFilter = (allowed: Set<string>, message: string) => {
  return (_req: unknown, file: Express.Multer.File, cb: (error: Error | null, accept: boolean) => void) => {
    if (!allowed.has(file.mimetype)) {
      return cb(new BadRequestException(message), false);
    }
    cb(null, true);
  };
};

@ApiTags('Advisor')
@ApiBearerAuth('access-token')
@Controller({ path: 'advisor', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.ADVISOR)
export class AdvisorController {
  constructor(private readonly advisorService: AdvisorService) {}

  @Get('dashboard/overview')
  getDashboardOverview(@GetUser() user: any) {
    return this.advisorService.getDashboardOverview(user);
  }

  @Get('my-projects')
  listMyProjects(@GetUser() user: any, @Query() query: Record<string, string | undefined>) {
    return this.advisorService.listMyProjects(user, query);
  }

  @Get('my-projects/:projectId')
  getMyProjectById(@GetUser() user: any, @Param('projectId') projectId: string) {
    return this.advisorService.getMyProjectById(user, projectId);
  }

  @Get('students')
  listStudents(@GetUser() user: any, @Query() query: Record<string, string | undefined>) {
    return this.advisorService.listStudents(user, query);
  }

  @Post('students/:projectId/clear')
  @HttpCode(200)
  clearProject(
    @GetUser() user: any,
    @Param('projectId') projectId: string,
    @Body() dto: ClearProjectDto
  ) {
    return this.advisorService.clearProject(user, projectId, dto);
  }

  @Post('students/:projectId/revision')
  @HttpCode(200)
  requestProjectRevision(
    @GetUser() user: any,
    @Param('projectId') projectId: string,
    @Body() dto: CreateProjectRevisionRequestDto
  ) {
    return this.advisorService.requestProjectRevision(user, projectId, dto);
  }

  @Get('evaluations')
  listEvaluations(@GetUser() user: any, @Query() query: Record<string, string | undefined>) {
    return this.advisorService.listEvaluations(user, query);
  }

  @Get('evaluations/:evaluationId')
  getEvaluationById(@GetUser() user: any, @Param('evaluationId') evaluationId: string) {
    return this.advisorService.getEvaluationById(user, evaluationId);
  }

  @Patch('evaluations/:evaluationId')
  @HttpCode(200)
  updateEvaluation(
    @GetUser() user: any,
    @Param('evaluationId') evaluationId: string,
    @Body() dto: UpdateProjectEvaluationDto
  ) {
    return this.advisorService.updateEvaluation(user, evaluationId, dto);
  }

  @Post('evaluations/:evaluationId/revision')
  @HttpCode(200)
  requestEvaluationRevision(
    @GetUser() user: any,
    @Param('evaluationId') evaluationId: string,
    @Body() dto: CreateProjectRevisionRequestDto
  ) {
    return this.advisorService.requestEvaluationRevision(user, evaluationId, dto);
  }

  @Get('documents')
  listDocuments(@GetUser() user: any, @Query() query: Record<string, string | undefined>) {
    return this.advisorService.listDocuments(user, query);
  }

  @Get('documents/:documentId')
  getDocumentById(@GetUser() user: any, @Param('documentId') documentId: string) {
    return this.advisorService.getDocumentById(user, documentId);
  }

  @Post('documents')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 50 * 1024 * 1024 },
      fileFilter: fileFilter(DOCUMENT_MIMES, 'Allowed: PDF, DOCX, JPG, PNG, WEBP, MP4, WEBM, ZIP.'),
    })
  )
  uploadDocument(
    @GetUser() user: any,
    @Body() dto: CreateProjectDocumentDto,
    @UploadedFile() file: Express.Multer.File
  ) {
    return this.advisorService.uploadDocument(user, dto, file);
  }

  @Post('documents/:documentId/approve')
  @HttpCode(200)
  approveDocument(
    @GetUser() user: any,
    @Param('documentId') documentId: string,
    @Body() dto: ReviewProjectDocumentDto
  ) {
    return this.advisorService.approveDocument(user, documentId, dto);
  }

  @Post('documents/:documentId/revision')
  @HttpCode(200)
  requestDocumentRevision(
    @GetUser() user: any,
    @Param('documentId') documentId: string,
    @Body() dto: ReviewProjectDocumentDto
  ) {
    return this.advisorService.requestDocumentRevision(user, documentId, dto);
  }

  @Get('schedule')
  listSchedule(@GetUser() user: any, @Query() query: Record<string, string | undefined>) {
    return this.advisorService.listSchedule(user, query);
  }

  @Post('schedule')
  createMeeting(@GetUser() user: any, @Body() dto: CreateProjectMeetingDto) {
    return this.advisorService.createMeeting(user, dto);
  }

  @Patch('schedule/:meetingId')
  @HttpCode(200)
  updateMeeting(
    @GetUser() user: any,
    @Param('meetingId') meetingId: string,
    @Body() dto: UpdateProjectMeetingDto
  ) {
    return this.advisorService.updateMeeting(user, meetingId, dto);
  }

  @Delete('schedule/:meetingId')
  @HttpCode(200)
  deleteMeeting(@GetUser() user: any, @Param('meetingId') meetingId: string) {
    return this.advisorService.deleteMeeting(user, meetingId);
  }

  @Get('announcements')
  listAnnouncements(@GetUser() user: any, @Query() query: Record<string, string | undefined>) {
    return this.advisorService.listAnnouncements(user, query);
  }

  @Post('announcements')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: fileFilter(ANNOUNCEMENT_MIMES, 'Allowed: PDF, DOCX, JPG, PNG, WEBP.'),
    })
  )
  createAnnouncement(
    @GetUser() user: any,
    @Body() dto: CreateAdvisorAnnouncementDto,
    @UploadedFile() file?: Express.Multer.File
  ) {
    return this.advisorService.createAnnouncement(user, dto, file);
  }

  @Get('messages/groups')
  listMessageGroups(@GetUser() user: any, @Query() query: Record<string, string | undefined>) {
    return this.advisorService.listMessageGroups(user, query);
  }

  @Post('messages/groups')
  createMessageGroup(@GetUser() user: any, @Body() dto: CreateAdvisorMessageGroupDto) {
    return this.advisorService.createMessageGroup(user, dto);
  }

  @Get('messages/groups/:groupId')
  getMessageGroupById(@GetUser() user: any, @Param('groupId') groupId: string) {
    return this.advisorService.getMessageGroupById(user, groupId);
  }

  @Get('messages/groups/:groupId/messages')
  listGroupMessages(
    @GetUser() user: any,
    @Param('groupId') groupId: string,
    @Query() query: Record<string, string | undefined>
  ) {
    return this.advisorService.listGroupMessages(user, groupId, query);
  }

  @Post('messages/groups/:groupId/messages')
  sendGroupMessage(
    @GetUser() user: any,
    @Param('groupId') groupId: string,
    @Body() dto: CreateAdvisorMessageDto
  ) {
    return this.advisorService.sendGroupMessage(user, groupId, dto);
  }
}
