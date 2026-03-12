import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import type {
  DepartmentDocumentTemplate,
  DepartmentDocumentTemplateFile,
  DocumentTemplateType,
} from '@prisma/client';
import { CloudinaryService } from '../../core/storage/cloudinary.service';
import { DepartmentDocumentTemplatesRepository } from './department-document-templates.repository';
import { CreateDepartmentDocumentTemplateDto } from './dto/create-department-document-template.dto';
import { ListDepartmentDocumentTemplatesQueryDto } from './dto/list-department-document-templates.dto';
import { UpdateDepartmentDocumentTemplateDto } from './dto/update-department-document-template.dto';
import { NotificationService } from '../notification/notification.service';

type TemplateWithFiles = DepartmentDocumentTemplate & { files: DepartmentDocumentTemplateFile[] };

@Injectable()
export class DepartmentDocumentTemplatesService {
  private readonly logger = new Logger(DepartmentDocumentTemplatesService.name);

  constructor(
    private readonly repository: DepartmentDocumentTemplatesRepository,
    private readonly cloudinaryService: CloudinaryService,
    private readonly notificationService: NotificationService
  ) {}

  private async assertDepartmentAccess(user: any, departmentId: string) {
    if (!user?.sub) {
      throw new ForbiddenException('Missing user context');
    }

    const tenantId: string | undefined = user?.tenantId;
    if (!tenantId) {
      throw new ForbiddenException('Missing tenant context');
    }

    const ctx = await this.repository.findUserDepartmentContext(user.sub);
    if (!ctx?.departmentId) {
      throw new ForbiddenException('User is not assigned to a department');
    }

    if (ctx.tenantId !== tenantId) {
      throw new ForbiddenException('Invalid tenant context');
    }

    if (ctx.departmentId !== departmentId) {
      throw new ForbiddenException('Access denied to department');
    }

    const ok = await this.repository.departmentExistsInTenant(departmentId, tenantId);
    if (!ok) {
      throw new ForbiddenException('Department not found for tenant');
    }

    return { tenantId };
  }

  async listDepartmentDocumentTemplates(
    departmentId: string,
    query: ListDepartmentDocumentTemplatesQueryDto,
    user: any
  ) {
    const { tenantId } = await this.assertDepartmentAccess(user, departmentId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const totalPromise = this.repository.countTemplates({
      tenantId,
      departmentId,
      type: query.type,
      isActive: query.isActive,
      search: query.search,
    });

    const templatesPromise = this.repository.findTemplates({
      tenantId,
      departmentId,
      type: query.type,
      isActive: query.isActive,
      search: query.search,
      skip,
      take: limit,
    });

    const [total, templates] = (await Promise.all([totalPromise, templatesPromise])) as [
      number,
      TemplateWithFiles[],
    ];

    return {
      templates: templates.map((t) => ({
        templateId: t.id,
        type: t.type,
        title: t.title,
        description: t.description,
        isActive: t.isActive,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        files: t.files.map((f) => ({
          fileId: f.id,
          fileName: f.fileName,
          mimeType: f.mimeType,
          sizeBytes: f.sizeBytes,
          url: f.fileUrl,
          createdAt: f.createdAt,
        })),
      })),
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getDepartmentDocumentTemplate(departmentId: string, templateId: string, user: any) {
    const { tenantId } = await this.assertDepartmentAccess(user, departmentId);

    const template = (await this.repository.findTemplateById({
      tenantId,
      departmentId,
      templateId,
    })) as TemplateWithFiles | null;

    if (!template) {
      throw new NotFoundException('Document template not found');
    }

    return {
      templateId: template.id,
      type: template.type,
      title: template.title,
      description: template.description,
      isActive: template.isActive,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
      files: template.files
        .slice()
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map((f) => ({
          fileId: f.id,
          fileName: f.fileName,
          mimeType: f.mimeType,
          sizeBytes: f.sizeBytes,
          url: f.fileUrl,
          createdAt: f.createdAt,
        })),
    };
  }

  async updateDepartmentDocumentTemplate(
    departmentId: string,
    templateId: string,
    dto: UpdateDepartmentDocumentTemplateDto,
    user: any
  ) {
    const { tenantId } = await this.assertDepartmentAccess(user, departmentId);

    const updated = (await this.repository.updateTemplate({
      tenantId,
      departmentId,
      templateId,
      data: {
        ...(dto.type !== undefined ? { type: dto.type as DocumentTemplateType } : {}),
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    })) as TemplateWithFiles | null;

    if (!updated) {
      throw new NotFoundException('Document template not found');
    }

    // Best-effort notification (do not block update)
    try {
      const department = await this.repository.findDepartmentById(departmentId);
      if (!department) {
        this.logger.warn(
          `DepartmentDocumentTemplateUpdatedNotification: department not found (${departmentId})`
        );
      } else if (department.tenantId !== tenantId) {
        this.logger.warn(
          `DepartmentDocumentTemplateUpdatedNotification: tenant mismatch (departmentId=${departmentId})`
        );
      } else {
        const userIds = await this.repository.findDepartmentUserIds(departmentId, tenantId);
        await this.notificationService.notifyDepartmentDocumentTemplateUpdated({
          tenantId,
          userIds,
          departmentId,
          departmentName: department.name ?? undefined,
          templateId: updated.id,
          templateTitle: updated.title,
          templateType: String(updated.type),
          actorUserId: user?.sub,
        });
      }
    } catch (err: any) {
      this.logger.warn(
        `DepartmentDocumentTemplateUpdatedNotification: failed (${err?.message ?? 'unknown error'})`
      );
    }

    return {
      message: 'Document template updated successfully',
      templateId: updated.id,
      title: updated.title,
      type: updated.type,
      updatedAt: updated.updatedAt,
    };
  }

  async createDepartmentDocumentTemplate(
    departmentId: string,
    dto: CreateDepartmentDocumentTemplateDto,
    files: Express.Multer.File[] | undefined,
    user: any
  ) {
    const { tenantId } = await this.assertDepartmentAccess(user, departmentId);

    if (!files || files.length === 0) {
      throw new BadRequestException('At least one file is required');
    }

    const uploads: Array<{
      file: Express.Multer.File;
      secureUrl: string;
      publicId: string;
      resourceType: 'raw';
    }> = [];

    try {
      for (const file of files) {
        const uploaded = await this.cloudinaryService.uploadDepartmentDocumentTemplateFile({
          tenantId,
          departmentId,
          userId: user.sub,
          buffer: file.buffer,
          mimeType: file.mimetype,
          fileName: file.originalname,
        });

        uploads.push({
          file,
          secureUrl: uploaded.secureUrl,
          publicId: uploaded.publicId,
          resourceType: uploaded.resourceType,
        });
      }

      const saved = await this.repository.createTemplate({
        tenantId,
        departmentId,
        type: dto.type as DocumentTemplateType,
        title: dto.title,
        description: dto.description,
        isActive: dto.isActive ?? true,
        createdById: user.sub,
        files: uploads.map((u) => ({
          fileName: u.file.originalname,
          mimeType: u.file.mimetype,
          sizeBytes: u.file.size,
          fileUrl: u.secureUrl,
          filePublicId: u.publicId,
          resourceType: u.resourceType,
          uploadedById: user.sub,
        })),
      });

      // Best-effort notification (do not block creation)
      try {
        const department = await this.repository.findDepartmentById(departmentId);
        if (!department) {
          this.logger.warn(
            `DepartmentDocumentTemplateNotification: department not found (${departmentId})`
          );
        } else if (department.tenantId !== tenantId) {
          this.logger.warn(
            `DepartmentDocumentTemplateNotification: tenant mismatch (departmentId=${departmentId})`
          );
        } else {
          const userIds = await this.repository.findDepartmentUserIds(departmentId, tenantId);

          await this.notificationService.notifyDepartmentDocumentTemplateCreated({
            tenantId,
            userIds,
            departmentId,
            departmentName: department.name ?? undefined,
            templateId: saved.id,
            templateTitle: saved.title,
            templateType: String(saved.type),
            fileCount: saved.files.length,
            actorUserId: user?.sub,
          });
        }
      } catch (err: any) {
        this.logger.warn(
          `DepartmentDocumentTemplateNotification: failed (${err?.message ?? 'unknown error'})`
        );
      }

      return {
        message: 'Department document template created successfully',
        templateId: saved.id,
        title: saved.title,
        type: saved.type,
        fileCount: saved.files.length,
        createdAt: saved.createdAt,
      };
    } catch (err) {
      await Promise.all(
        uploads.map((u) =>
          this.cloudinaryService.deleteByPublicId(u.publicId, u.resourceType).catch(() => undefined)
        )
      );
      throw err;
    }
  }

  async addFilesToDepartmentDocumentTemplate(
    departmentId: string,
    templateId: string,
    files: Express.Multer.File[] | undefined,
    user: any
  ) {
    const { tenantId } = await this.assertDepartmentAccess(user, departmentId);

    const existing = await this.repository.findTemplateById({ tenantId, departmentId, templateId });
    if (!existing) {
      throw new NotFoundException('Document template not found');
    }

    if (!files || files.length === 0) {
      throw new BadRequestException('At least one file is required');
    }

    const uploads: Array<{
      file: Express.Multer.File;
      secureUrl: string;
      publicId: string;
      resourceType: 'raw';
    }> = [];

    try {
      for (const file of files) {
        const uploaded = await this.cloudinaryService.uploadDepartmentDocumentTemplateFile({
          tenantId,
          departmentId,
          userId: user.sub,
          buffer: file.buffer,
          mimeType: file.mimetype,
          fileName: file.originalname,
        });

        uploads.push({
          file,
          secureUrl: uploaded.secureUrl,
          publicId: uploaded.publicId,
          resourceType: uploaded.resourceType,
        });
      }

      await this.repository.addFiles({
        templateId,
        files: uploads.map((u) => ({
          fileName: u.file.originalname,
          mimeType: u.file.mimetype,
          sizeBytes: u.file.size,
          fileUrl: u.secureUrl,
          filePublicId: u.publicId,
          resourceType: u.resourceType,
          uploadedById: user.sub,
        })),
      });

      return {
        message: 'Files uploaded successfully',
        uploadedCount: uploads.length,
      };
    } catch (err) {
      await Promise.all(
        uploads.map((u) =>
          this.cloudinaryService.deleteByPublicId(u.publicId, u.resourceType).catch(() => undefined)
        )
      );
      throw err;
    }
  }

  async replaceFilesForDepartmentDocumentTemplate(
    departmentId: string,
    templateId: string,
    files: Express.Multer.File[] | undefined,
    user: any
  ) {
    const { tenantId } = await this.assertDepartmentAccess(user, departmentId);

    const existing = (await this.repository.findTemplateById({
      tenantId,
      departmentId,
      templateId,
    })) as TemplateWithFiles | null;

    if (!existing) {
      throw new NotFoundException('Document template not found');
    }

    if (!files || files.length === 0) {
      throw new BadRequestException('At least one file is required');
    }

    const uploads: Array<{
      file: Express.Multer.File;
      secureUrl: string;
      publicId: string;
      resourceType: 'raw';
    }> = [];

    try {
      for (const file of files) {
        const uploaded = await this.cloudinaryService.uploadDepartmentDocumentTemplateFile({
          tenantId,
          departmentId,
          userId: user.sub,
          buffer: file.buffer,
          mimeType: file.mimetype,
          fileName: file.originalname,
        });

        uploads.push({
          file,
          secureUrl: uploaded.secureUrl,
          publicId: uploaded.publicId,
          resourceType: uploaded.resourceType,
        });
      }

      await this.repository.replaceFiles({
        templateId,
        files: uploads.map((u) => ({
          fileName: u.file.originalname,
          mimeType: u.file.mimetype,
          sizeBytes: u.file.size,
          fileUrl: u.secureUrl,
          filePublicId: u.publicId,
          resourceType: u.resourceType,
          uploadedById: user.sub,
        })),
      });

      await Promise.all(
        existing.files.map((f) =>
          this.cloudinaryService.deleteByPublicId(f.filePublicId, 'raw').catch(() => undefined)
        )
      );

      return {
        message: 'Files replaced successfully',
        uploadedCount: uploads.length,
      };
    } catch (err) {
      await Promise.all(
        uploads.map((u) =>
          this.cloudinaryService.deleteByPublicId(u.publicId, u.resourceType).catch(() => undefined)
        )
      );
      throw err;
    }
  }

  async deleteFileFromDepartmentDocumentTemplate(
    departmentId: string,
    templateId: string,
    fileId: string,
    user: any
  ) {
    const { tenantId } = await this.assertDepartmentAccess(user, departmentId);

    const file = await this.repository.findFileById({ tenantId, departmentId, templateId, fileId });
    if (!file) {
      throw new NotFoundException('Document template file not found');
    }

    const ok = await this.repository.deleteFile({ templateId, fileId });
    if (!ok) {
      throw new NotFoundException('Document template file not found');
    }

    await this.cloudinaryService.deleteByPublicId(file.filePublicId, 'raw').catch(() => undefined);

    return {
      message: 'File deleted successfully',
    };
  }

  async deleteDepartmentDocumentTemplate(departmentId: string, templateId: string, user: any) {
    const { tenantId } = await this.assertDepartmentAccess(user, departmentId);

    const existing = await this.repository.findTemplateById({ tenantId, departmentId, templateId });
    if (!existing) {
      throw new NotFoundException('Document template not found');
    }

    const ok = await this.repository.deleteTemplate({ tenantId, departmentId, templateId });
    if (!ok) {
      throw new NotFoundException('Document template not found');
    }

    // Best-effort notification (do not block delete)
    try {
      const department = await this.repository.findDepartmentById(departmentId);
      if (!department) {
        this.logger.warn(
          `DepartmentDocumentTemplateDeletedNotification: department not found (${departmentId})`
        );
      } else if (department.tenantId !== tenantId) {
        this.logger.warn(
          `DepartmentDocumentTemplateDeletedNotification: tenant mismatch (departmentId=${departmentId})`
        );
      } else {
        const userIds = await this.repository.findDepartmentUserIds(departmentId, tenantId);
        await this.notificationService.notifyDepartmentDocumentTemplateDeleted({
          tenantId,
          userIds,
          departmentId,
          departmentName: department.name ?? undefined,
          templateId,
          templateTitle: existing.title,
          templateType: String(existing.type),
          actorUserId: user?.sub,
        });
      }
    } catch (err: any) {
      this.logger.warn(
        `DepartmentDocumentTemplateDeletedNotification: failed (${err?.message ?? 'unknown error'})`
      );
    }

    await Promise.all(
      existing.files.map((f) =>
        this.cloudinaryService.deleteByPublicId(f.filePublicId, 'raw').catch(() => undefined)
      )
    );

    return {
      message: 'Document template deleted successfully',
    };
  }
}
