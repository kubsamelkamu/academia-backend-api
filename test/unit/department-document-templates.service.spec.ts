import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DepartmentDocumentTemplatesService } from '../../src/modules/department/department-document-templates.service';

describe('DepartmentDocumentTemplatesService', () => {
  const repo: any = {
    findUserDepartmentContext: jest.fn(),
    departmentExistsInTenant: jest.fn(),
    findDepartmentById: jest.fn(),
    findDepartmentUserIds: jest.fn(),
    countTemplates: jest.fn(),
    findTemplates: jest.fn(),
    createTemplate: jest.fn(),
    findTemplateById: jest.fn(),
    updateTemplate: jest.fn(),
    addFiles: jest.fn(),
    replaceFiles: jest.fn(),
    findFileById: jest.fn(),
    deleteFile: jest.fn(),
    deleteTemplate: jest.fn(),
  };

  const cloudinary: any = {
    uploadDepartmentDocumentTemplateFile: jest.fn(),
    deleteByPublicId: jest.fn(),
  };

  const notificationService: any = {
    notifyDepartmentDocumentTemplateCreated: jest.fn(),
  };

  let service: DepartmentDocumentTemplatesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DepartmentDocumentTemplatesService(repo, cloudinary, notificationService);
  });

  it('rejects access when departmentId does not match user department', async () => {
    repo.findUserDepartmentContext.mockResolvedValue({ tenantId: 't1', departmentId: 'd1' });
    repo.departmentExistsInTenant.mockResolvedValue(true);

    await expect(
      service.listDepartmentDocumentTemplates(
        'd2',
        { page: 1, limit: 10 },
        { sub: 'u1', tenantId: 't1' }
      )
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires at least one file on create', async () => {
    repo.findUserDepartmentContext.mockResolvedValue({ tenantId: 't1', departmentId: 'd1' });
    repo.departmentExistsInTenant.mockResolvedValue(true);

    await expect(
      service.createDepartmentDocumentTemplate(
        'd1',
        { type: 'SRS' as any, title: 'SRS Template' },
        [],
        { sub: 'u1', tenantId: 't1' }
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lists templates with pagination', async () => {
    repo.findUserDepartmentContext.mockResolvedValue({ tenantId: 't1', departmentId: 'd1' });
    repo.departmentExistsInTenant.mockResolvedValue(true);

    repo.countTemplates.mockResolvedValue(1);
    repo.findTemplates.mockResolvedValue([
      {
        id: 'tpl1',
        type: 'SRS',
        title: 'SRS',
        description: null,
        isActive: true,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-01T00:00:00Z'),
        files: [
          {
            id: 'f1',
            fileName: 'srs.pdf',
            mimeType: 'application/pdf',
            sizeBytes: 123,
            fileUrl: 'https://example.com/srs.pdf',
            createdAt: new Date('2024-01-01T00:00:00Z'),
          },
        ],
      },
    ]);

    const result = await service.listDepartmentDocumentTemplates(
      'd1',
      { page: 1, limit: 10 },
      { sub: 'u1', tenantId: 't1' }
    );

    expect(result.pagination).toEqual({ total: 1, page: 1, limit: 10, pages: 1 });
    expect(result.templates).toHaveLength(1);
    expect(result.templates[0].files).toHaveLength(1);
    expect(result.templates[0].files[0].url).toBe('https://example.com/srs.pdf');
  });

  it('gets a single template by id', async () => {
    repo.findUserDepartmentContext.mockResolvedValue({ tenantId: 't1', departmentId: 'd1' });
    repo.departmentExistsInTenant.mockResolvedValue(true);

    repo.findTemplateById.mockResolvedValue({
      id: 'tpl1',
      type: 'SRS',
      title: 'SRS',
      description: null,
      isActive: true,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-02T00:00:00Z'),
      files: [
        {
          id: 'f1',
          fileName: 'srs.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 123,
          fileUrl: 'https://example.com/srs.pdf',
          filePublicId: 'p1',
          createdAt: new Date('2024-01-01T00:00:00Z'),
        },
      ],
    });

    const result = await service.getDepartmentDocumentTemplate(
      'd1',
      'tpl1',
      { sub: 'u1', tenantId: 't1' }
    );

    expect(result.templateId).toBe('tpl1');
    expect(result.files).toHaveLength(1);
    expect(result.files[0].url).toBe('https://example.com/srs.pdf');
  });

  it('updates template metadata', async () => {
    repo.findUserDepartmentContext.mockResolvedValue({ tenantId: 't1', departmentId: 'd1' });
    repo.departmentExistsInTenant.mockResolvedValue(true);

    repo.updateTemplate.mockResolvedValue({
      id: 'tpl1',
      type: 'SDD',
      title: 'Updated',
      description: 'x',
      isActive: false,
      createdAt: new Date('2024-01-01T00:00:00Z'),
      updatedAt: new Date('2024-01-03T00:00:00Z'),
      files: [],
    });

    const result = await service.updateDepartmentDocumentTemplate(
      'd1',
      'tpl1',
      { type: 'SDD' as any, title: 'Updated', isActive: false },
      { sub: 'u1', tenantId: 't1' }
    );

    expect(repo.updateTemplate).toHaveBeenCalled();
    expect(result).toEqual({
      message: 'Document template updated successfully',
      templateId: 'tpl1',
      title: 'Updated',
      type: 'SDD',
      updatedAt: new Date('2024-01-03T00:00:00Z'),
    });
  });

  it('creates a template and uploads files', async () => {
    repo.findUserDepartmentContext.mockResolvedValue({ tenantId: 't1', departmentId: 'd1' });
    repo.departmentExistsInTenant.mockResolvedValue(true);

    cloudinary.uploadDepartmentDocumentTemplateFile
      .mockResolvedValueOnce({ secureUrl: 'u1', publicId: 'p1', resourceType: 'raw' })
      .mockResolvedValueOnce({ secureUrl: 'u2', publicId: 'p2', resourceType: 'raw' });

    repo.createTemplate.mockResolvedValue({
      id: 'tpl1',
      title: 'SRS',
      type: 'SRS',
      createdAt: new Date('2024-01-01T00:00:00Z'),
      files: [{ id: 'f1' }, { id: 'f2' }],
    });

    const files: any[] = [
      {
        buffer: Buffer.from('a'),
        mimetype: 'application/pdf',
        originalname: 'a.pdf',
        size: 10,
      },
      {
        buffer: Buffer.from('b'),
        mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        originalname: 'b.docx',
        size: 20,
      },
    ];

    const result = await service.createDepartmentDocumentTemplate(
      'd1',
      { type: 'SRS' as any, title: 'SRS', description: 'x', isActive: true },
      files as any,
      { sub: 'u1', tenantId: 't1' }
    );

    expect(cloudinary.uploadDepartmentDocumentTemplateFile).toHaveBeenCalledTimes(2);
    expect(repo.createTemplate).toHaveBeenCalledTimes(1);
    expect(result.fileCount).toBe(2);
  });

  it('adds files to an existing template', async () => {
    repo.findUserDepartmentContext.mockResolvedValue({ tenantId: 't1', departmentId: 'd1' });
    repo.departmentExistsInTenant.mockResolvedValue(true);
    repo.findTemplateById.mockResolvedValue({ id: 'tpl1', files: [] });

    cloudinary.uploadDepartmentDocumentTemplateFile.mockResolvedValue({
      secureUrl: 'u1',
      publicId: 'p1',
      resourceType: 'raw',
    });

    repo.addFiles.mockResolvedValue(undefined);

    const files: any[] = [
      {
        buffer: Buffer.from('a'),
        mimetype: 'application/pdf',
        originalname: 'a.pdf',
        size: 10,
      },
    ];

    const result = await service.addFilesToDepartmentDocumentTemplate(
      'd1',
      'tpl1',
      files as any,
      { sub: 'u1', tenantId: 't1' }
    );

    expect(repo.addFiles).toHaveBeenCalled();
    expect(result).toEqual({ message: 'Files uploaded successfully', uploadedCount: 1 });
  });

  it('replaces files and deletes old cloudinary assets after success', async () => {
    repo.findUserDepartmentContext.mockResolvedValue({ tenantId: 't1', departmentId: 'd1' });
    repo.departmentExistsInTenant.mockResolvedValue(true);
    repo.findTemplateById.mockResolvedValue({
      id: 'tpl1',
      files: [{ filePublicId: 'old1' }, { filePublicId: 'old2' }],
    });

    cloudinary.uploadDepartmentDocumentTemplateFile.mockResolvedValue({
      secureUrl: 'u1',
      publicId: 'p1',
      resourceType: 'raw',
    });
    repo.replaceFiles.mockResolvedValue(undefined);
    cloudinary.deleteByPublicId.mockResolvedValue(undefined);

    const files: any[] = [
      {
        buffer: Buffer.from('a'),
        mimetype: 'application/pdf',
        originalname: 'a.pdf',
        size: 10,
      },
    ];

    const result = await service.replaceFilesForDepartmentDocumentTemplate(
      'd1',
      'tpl1',
      files as any,
      { sub: 'u1', tenantId: 't1' }
    );

    expect(repo.replaceFiles).toHaveBeenCalled();
    expect(cloudinary.deleteByPublicId).toHaveBeenCalledWith('old1', 'raw');
    expect(cloudinary.deleteByPublicId).toHaveBeenCalledWith('old2', 'raw');
    expect(result).toEqual({ message: 'Files replaced successfully', uploadedCount: 1 });
  });

  it('deletes a single file (DB + Cloudinary)', async () => {
    repo.findUserDepartmentContext.mockResolvedValue({ tenantId: 't1', departmentId: 'd1' });
    repo.departmentExistsInTenant.mockResolvedValue(true);

    repo.findFileById.mockResolvedValue({
      id: 'f1',
      templateId: 'tpl1',
      filePublicId: 'p1',
    });
    repo.deleteFile.mockResolvedValue(true);
    cloudinary.deleteByPublicId.mockResolvedValue(undefined);

    const result = await service.deleteFileFromDepartmentDocumentTemplate(
      'd1',
      'tpl1',
      'f1',
      { sub: 'u1', tenantId: 't1' }
    );

    expect(repo.deleteFile).toHaveBeenCalledWith({ templateId: 'tpl1', fileId: 'f1' });
    expect(cloudinary.deleteByPublicId).toHaveBeenCalledWith('p1', 'raw');
    expect(result).toEqual({ message: 'File deleted successfully' });
  });

  it('cleans up uploaded files if DB create fails', async () => {
    repo.findUserDepartmentContext.mockResolvedValue({ tenantId: 't1', departmentId: 'd1' });
    repo.departmentExistsInTenant.mockResolvedValue(true);

    cloudinary.uploadDepartmentDocumentTemplateFile.mockResolvedValue({
      secureUrl: 'u1',
      publicId: 'p1',
      resourceType: 'raw',
    });

    const dbError = new Error('db failed');
    repo.createTemplate.mockRejectedValue(dbError);

    cloudinary.deleteByPublicId.mockResolvedValue(undefined);

    const files: any[] = [
      {
        buffer: Buffer.from('a'),
        mimetype: 'application/pdf',
        originalname: 'a.pdf',
        size: 10,
      },
    ];

    await expect(
      service.createDepartmentDocumentTemplate(
        'd1',
        { type: 'SRS' as any, title: 'SRS', isActive: true },
        files as any,
        { sub: 'u1', tenantId: 't1' }
      )
    ).rejects.toBe(dbError);

    expect(cloudinary.deleteByPublicId).toHaveBeenCalledWith('p1', 'raw');
  });

  it('throws NotFound when deleting a missing template', async () => {
    repo.findUserDepartmentContext.mockResolvedValue({ tenantId: 't1', departmentId: 'd1' });
    repo.departmentExistsInTenant.mockResolvedValue(true);
    repo.findTemplateById.mockResolvedValue(null);

    await expect(
      service.deleteDepartmentDocumentTemplate('d1', 'missing', { sub: 'u1', tenantId: 't1' })
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
