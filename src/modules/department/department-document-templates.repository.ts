import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DocumentTemplateType } from '@prisma/client';

@Injectable()
export class DepartmentDocumentTemplatesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUserDepartmentContext(userId: string): Promise<{ tenantId: string; departmentId: string | null } | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { tenantId: true, departmentId: true },
    });
  }

  async departmentExistsInTenant(departmentId: string, tenantId: string): Promise<boolean> {
    const found = await this.prisma.department.findFirst({
      where: { id: departmentId, tenantId },
      select: { id: true },
    });
    return !!found;
  }

  async findDepartmentById(departmentId: string) {
    return this.prisma.department.findUnique({
      where: { id: departmentId },
      select: {
        id: true,
        tenantId: true,
        name: true,
      },
    });
  }

  async findDepartmentUserIds(departmentId: string, tenantId: string) {
    const users = await this.prisma.user.findMany({
      where: {
        tenantId,
        departmentId,
        deletedAt: null,
      },
      select: { id: true },
    });

    return users.map((u) => u.id);
  }

  async countTemplates(params: {
    tenantId: string;
    departmentId: string;
    type?: DocumentTemplateType;
    isActive?: boolean;
    search?: string;
  }): Promise<number> {
    return this.prisma.departmentDocumentTemplate.count({
      where: {
        tenantId: params.tenantId,
        departmentId: params.departmentId,
        ...(params.type !== undefined ? { type: params.type } : {}),
        ...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
        ...(params.search
          ? {
              title: {
                contains: params.search,
                mode: 'insensitive',
              },
            }
          : {}),
      },
    });
  }

  async findTemplates(params: {
    tenantId: string;
    departmentId: string;
    type?: DocumentTemplateType;
    isActive?: boolean;
    search?: string;
    skip: number;
    take: number;
  }) {
    return this.prisma.departmentDocumentTemplate.findMany({
      where: {
        tenantId: params.tenantId,
        departmentId: params.departmentId,
        ...(params.type !== undefined ? { type: params.type } : {}),
        ...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
        ...(params.search
          ? {
              title: {
                contains: params.search,
                mode: 'insensitive',
              },
            }
          : {}),
      },
      include: {
        files: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: params.skip,
      take: params.take,
    });
  }

  async createTemplate(params: {
    tenantId: string;
    departmentId: string;
    type: DocumentTemplateType;
    title: string;
    description?: string;
    isActive: boolean;
    createdById?: string;
    files: Array<{
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      fileUrl: string;
      filePublicId: string;
      resourceType: string;
      uploadedById?: string;
    }>;
  }) {
    return this.prisma.departmentDocumentTemplate.create({
      data: {
        tenantId: params.tenantId,
        departmentId: params.departmentId,
        type: params.type,
        title: params.title,
        description: params.description,
        isActive: params.isActive,
        createdById: params.createdById,
        files: {
          create: params.files.map((f) => ({
            fileName: f.fileName,
            mimeType: f.mimeType,
            sizeBytes: f.sizeBytes,
            fileUrl: f.fileUrl,
            filePublicId: f.filePublicId,
            resourceType: f.resourceType,
            uploadedById: f.uploadedById,
          })),
        },
      },
      include: { files: true },
    });
  }

  async findTemplateById(params: { tenantId: string; departmentId: string; templateId: string }) {
    return this.prisma.departmentDocumentTemplate.findFirst({
      where: {
        id: params.templateId,
        tenantId: params.tenantId,
        departmentId: params.departmentId,
      },
      include: { files: true },
    });
  }

  async updateTemplate(params: {
    tenantId: string;
    departmentId: string;
    templateId: string;
    data: {
      type?: DocumentTemplateType;
      title?: string;
      description?: string | null;
      isActive?: boolean;
    };
  }) {
    const updated = await this.prisma.departmentDocumentTemplate.updateMany({
      where: {
        id: params.templateId,
        tenantId: params.tenantId,
        departmentId: params.departmentId,
      },
      data: params.data,
    });

    if (updated.count === 0) return null;

    return this.findTemplateById({
      tenantId: params.tenantId,
      departmentId: params.departmentId,
      templateId: params.templateId,
    });
  }

  async addFiles(params: {
    templateId: string;
    files: Array<{
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      fileUrl: string;
      filePublicId: string;
      resourceType: string;
      uploadedById?: string;
    }>;
  }) {
    await this.prisma.departmentDocumentTemplateFile.createMany({
      data: params.files.map((f) => ({
        templateId: params.templateId,
        fileName: f.fileName,
        mimeType: f.mimeType,
        sizeBytes: f.sizeBytes,
        fileUrl: f.fileUrl,
        filePublicId: f.filePublicId,
        resourceType: f.resourceType,
        uploadedById: f.uploadedById,
      })),
    });
  }

  async replaceFiles(params: {
    templateId: string;
    files: Array<{
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      fileUrl: string;
      filePublicId: string;
      resourceType: string;
      uploadedById?: string;
    }>;
  }) {
    await this.prisma.$transaction([
      this.prisma.departmentDocumentTemplateFile.deleteMany({
        where: { templateId: params.templateId },
      }),
      this.prisma.departmentDocumentTemplateFile.createMany({
        data: params.files.map((f) => ({
          templateId: params.templateId,
          fileName: f.fileName,
          mimeType: f.mimeType,
          sizeBytes: f.sizeBytes,
          fileUrl: f.fileUrl,
          filePublicId: f.filePublicId,
          resourceType: f.resourceType,
          uploadedById: f.uploadedById,
        })),
      }),
    ]);
  }

  async findFileById(params: {
    tenantId: string;
    departmentId: string;
    templateId: string;
    fileId: string;
  }) {
    return this.prisma.departmentDocumentTemplateFile.findFirst({
      where: {
        id: params.fileId,
        templateId: params.templateId,
        template: {
          id: params.templateId,
          tenantId: params.tenantId,
          departmentId: params.departmentId,
        },
      },
    });
  }

  async deleteFile(params: { templateId: string; fileId: string }): Promise<boolean> {
    const deleted = await this.prisma.departmentDocumentTemplateFile.deleteMany({
      where: {
        id: params.fileId,
        templateId: params.templateId,
      },
    });

    return deleted.count > 0;
  }

  async deleteTemplate(params: { tenantId: string; departmentId: string; templateId: string }): Promise<boolean> {
    const deleted = await this.prisma.departmentDocumentTemplate.deleteMany({
      where: {
        id: params.templateId,
        tenantId: params.tenantId,
        departmentId: params.departmentId,
      },
    });
    return deleted.count > 0;
  }
}
