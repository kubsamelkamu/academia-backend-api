import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Patch,
  Put,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Roles } from '../../common/decorators/roles.decorator';
import { ROLES } from '../../common/constants/roles.constants';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { DepartmentDocumentTemplatesService } from './department-document-templates.service';
import { CreateDepartmentDocumentTemplateDto } from './dto/create-department-document-template.dto';
import { ListDepartmentDocumentTemplatesQueryDto } from './dto/list-department-document-templates.dto';
import { UpdateDepartmentDocumentTemplateDto } from './dto/update-department-document-template.dto';

@ApiTags('Department Document Templates')
@Controller({ path: 'departments/:departmentId/document-templates', version: '1' })
export class DepartmentDocumentTemplatesController {
  constructor(private readonly service: DepartmentDocumentTemplatesService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.DEPARTMENT_HEAD, ROLES.COORDINATOR, ROLES.ADVISOR, ROLES.STUDENT)
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List all document templates for a department' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'isActive', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiResponse({ status: 200, description: 'Document templates retrieved successfully' })
  async list(
    @Param('departmentId') departmentId: string,
    @Query() query: ListDepartmentDocumentTemplatesQueryDto,
    @GetUser() user: any
  ) {
    return this.service.listDepartmentDocumentTemplates(departmentId, query, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.DEPARTMENT_HEAD, ROLES.COORDINATOR, ROLES.ADVISOR, ROLES.STUDENT)
  @Get(':templateId')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get a single document template for a department' })
  @ApiResponse({ status: 200, description: 'Document template retrieved successfully' })
  async getOne(
    @Param('departmentId') departmentId: string,
    @Param('templateId') templateId: string,
    @GetUser() user: any
  ) {
    return this.service.getDepartmentDocumentTemplate(departmentId, templateId, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.DEPARTMENT_HEAD, ROLES.COORDINATOR)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('access-token')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['SRS', 'SDD', 'REPORT', 'OTHER'] },
        title: { type: 'string' },
        description: { type: 'string' },
        isActive: { type: 'boolean' },
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
      required: ['type', 'title', 'files'],
    },
  })
  @ApiOperation({ summary: 'Create a document template for a department (PDF/DOCX, max 10MB each)' })
  @ApiResponse({ status: 201, description: 'Document template created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file type or size' })
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
      fileFilter: (req, file, cb) => {
        const allowed = new Set([
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ]);
        if (!allowed.has(file.mimetype)) {
          return cb(new BadRequestException('Invalid file type. Allowed: PDF, DOCX.'), false);
        }
        cb(null, true);
      },
    })
  )
  async create(
    @Param('departmentId') departmentId: string,
    @Body() dto: CreateDepartmentDocumentTemplateDto,
    @UploadedFiles() files: Express.Multer.File[],
    @GetUser() user: any
  ) {
    return this.service.createDepartmentDocumentTemplate(departmentId, dto, files, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.DEPARTMENT_HEAD, ROLES.COORDINATOR)
  @Patch(':templateId')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update a document template metadata for a department' })
  @ApiResponse({ status: 200, description: 'Document template updated successfully' })
  async update(
    @Param('departmentId') departmentId: string,
    @Param('templateId') templateId: string,
    @Body() dto: UpdateDepartmentDocumentTemplateDto,
    @GetUser() user: any
  ) {
    return this.service.updateDepartmentDocumentTemplate(departmentId, templateId, dto, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.DEPARTMENT_HEAD, ROLES.COORDINATOR)
  @Post(':templateId/files')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('access-token')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
      required: ['files'],
    },
  })
  @ApiOperation({ summary: 'Upload additional files for an existing document template' })
  @ApiResponse({ status: 201, description: 'Files uploaded successfully' })
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
      fileFilter: (req, file, cb) => {
        const allowed = new Set([
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ]);
        if (!allowed.has(file.mimetype)) {
          return cb(new BadRequestException('Invalid file type. Allowed: PDF, DOCX.'), false);
        }
        cb(null, true);
      },
    })
  )
  async addFiles(
    @Param('departmentId') departmentId: string,
    @Param('templateId') templateId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @GetUser() user: any
  ) {
    return this.service.addFilesToDepartmentDocumentTemplate(departmentId, templateId, files, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.DEPARTMENT_HEAD, ROLES.COORDINATOR)
  @Put(':templateId/files')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
      required: ['files'],
    },
  })
  @ApiOperation({ summary: 'Replace all files for an existing document template' })
  @ApiResponse({ status: 200, description: 'Files replaced successfully' })
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
      fileFilter: (req, file, cb) => {
        const allowed = new Set([
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ]);
        if (!allowed.has(file.mimetype)) {
          return cb(new BadRequestException('Invalid file type. Allowed: PDF, DOCX.'), false);
        }
        cb(null, true);
      },
    })
  )
  async replaceFiles(
    @Param('departmentId') departmentId: string,
    @Param('templateId') templateId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @GetUser() user: any
  ) {
    return this.service.replaceFilesForDepartmentDocumentTemplate(departmentId, templateId, files, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.DEPARTMENT_HEAD, ROLES.COORDINATOR)
  @Delete(':templateId/files/:fileId')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete a single file from a document template' })
  @ApiResponse({ status: 200, description: 'File deleted successfully' })
  async deleteFile(
    @Param('departmentId') departmentId: string,
    @Param('templateId') templateId: string,
    @Param('fileId') fileId: string,
    @GetUser() user: any
  ) {
    return this.service.deleteFileFromDepartmentDocumentTemplate(departmentId, templateId, fileId, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.DEPARTMENT_HEAD, ROLES.COORDINATOR)
  @Delete(':templateId')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete a document template for a department' })
  @ApiResponse({ status: 200, description: 'Document template deleted successfully' })
  async remove(
    @Param('departmentId') departmentId: string,
    @Param('templateId') templateId: string,
    @GetUser() user: any
  ) {
    return this.service.deleteDepartmentDocumentTemplate(departmentId, templateId, user);
  }
}
