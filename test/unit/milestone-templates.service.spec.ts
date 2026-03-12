import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { MilestoneTemplatesService } from '../../src/modules/milestone/milestone-templates.service';

describe('MilestoneTemplatesService', () => {
  const repo: any = {
    findUserDepartmentContext: jest.fn(),
    departmentExistsInTenant: jest.fn(),
    findDepartmentById: jest.fn(),
    findDepartmentUserIds: jest.fn(),
    countTemplates: jest.fn(),
    findTemplates: jest.fn(),
    getUsageCounts: jest.fn(),
    createTemplate: jest.fn(),
    updateTemplate: jest.fn(),
    deleteTemplate: jest.fn(),
  };

  const notificationService: any = {
    notifyMilestoneTemplateCreated: jest.fn(),
  };

  let service: MilestoneTemplatesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MilestoneTemplatesService(repo, notificationService);
  });

  it('rejects access when departmentId does not match user department', async () => {
    repo.findUserDepartmentContext.mockResolvedValue({
      id: 'u1',
      tenantId: 't1',
      departmentId: 'd1',
    });
    repo.departmentExistsInTenant.mockResolvedValue(true);

    await expect(
      service.listMilestoneTemplates('d2', { page: 1, limit: 10 }, { sub: 'u1', tenantId: 't1' })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects duplicate milestone sequence values on create', async () => {
    repo.findUserDepartmentContext.mockResolvedValue({
      id: 'u1',
      tenantId: 't1',
      departmentId: 'd1',
    });
    repo.departmentExistsInTenant.mockResolvedValue(true);

    await expect(
      service.createMilestoneTemplate(
        'd1',
        {
          name: 'Template',
          milestones: [
            {
              sequence: 1,
              title: 'A',
              defaultDurationDays: 10,
              hasDeliverable: true,
              requiredDocuments: ['a.pdf'],
              isRequired: true,
            },
            {
              sequence: 1,
              title: 'B',
              defaultDurationDays: 10,
              hasDeliverable: false,
              requiredDocuments: [],
              isRequired: true,
            },
          ],
          isActive: true,
        },
        { sub: 'u1', tenantId: 't1' }
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('emits notification when milestone template is created', async () => {
    repo.findUserDepartmentContext.mockResolvedValue({
      id: 'u1',
      tenantId: 't1',
      departmentId: 'd1',
    });
    repo.departmentExistsInTenant.mockResolvedValue(true);

    repo.createTemplate.mockResolvedValue({
      id: 'tpl_1',
      name: 'Standard',
      createdAt: new Date('2026-03-01T00:00:00Z'),
      milestones: [{ id: 'm1' }, { id: 'm2' }],
    });

    repo.findDepartmentById.mockResolvedValue({
      id: 'd1',
      tenantId: 't1',
      name: 'CS',
    });

    repo.findDepartmentUserIds.mockResolvedValue(['u1', 'u2']);

    const result = await service.createMilestoneTemplate(
      'd1',
      {
        name: 'Standard',
        milestones: [
          {
            sequence: 1,
            title: 'A',
            defaultDurationDays: 10,
            hasDeliverable: true,
            requiredDocuments: ['a.pdf'],
            isRequired: true,
          },
          {
            sequence: 2,
            title: 'B',
            defaultDurationDays: 5,
            hasDeliverable: false,
            requiredDocuments: [],
            isRequired: true,
          },
        ],
        isActive: true,
      },
      { sub: 'u1', tenantId: 't1' }
    );

    expect(result).toEqual({
      message: 'Milestone template created successfully',
      templateId: 'tpl_1',
      name: 'Standard',
      milestoneCount: 2,
      createdAt: new Date('2026-03-01T00:00:00Z'),
    });

    expect(notificationService.notifyMilestoneTemplateCreated).toHaveBeenCalledWith({
      tenantId: 't1',
      userIds: ['u1', 'u2'],
      departmentId: 'd1',
      departmentName: 'CS',
      templateId: 'tpl_1',
      templateName: 'Standard',
      milestoneCount: 2,
      actorUserId: 'u1',
    });
  });

  it('lists templates with pagination and usageCount mapping', async () => {
    repo.findUserDepartmentContext.mockResolvedValue({
      id: 'u1',
      tenantId: 't1',
      departmentId: 'd1',
    });
    repo.departmentExistsInTenant.mockResolvedValue(true);

    repo.countTemplates.mockResolvedValue(2);
    repo.findTemplates.mockResolvedValue([
      {
        id: 'tpl1',
        name: 'Standard',
        description: null,
        isActive: true,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        milestones: [
          {
            sequence: 2,
            title: 'B',
            description: null,
            defaultDurationDays: 21,
            hasDeliverable: true,
            requiredDocuments: ['b.pdf'],
            isRequired: true,
          },
          {
            sequence: 1,
            title: 'A',
            description: 'Desc',
            defaultDurationDays: 30,
            hasDeliverable: false,
            requiredDocuments: null,
            isRequired: false,
          },
        ],
      },
    ]);

    repo.getUsageCounts.mockResolvedValue(new Map([['tpl1', 45]]));

    const result = await service.listMilestoneTemplates(
      'd1',
      { page: 1, limit: 10, search: 'std' },
      { sub: 'u1', tenantId: 't1' }
    );

    expect(result.pagination).toEqual({ total: 2, page: 1, limit: 10, pages: 1 });
    expect(result.templates).toHaveLength(1);
    expect(result.templates[0].usageCount).toBe(45);
    expect(result.templates[0].milestones.map((m: any) => m.sequence)).toEqual([1, 2]);
    expect(result.templates[0].milestones[0].requiredDocuments).toEqual([]);
  });

  it('updates a template and replaces milestones when provided', async () => {
    repo.findUserDepartmentContext.mockResolvedValue({
      id: 'u1',
      tenantId: 't1',
      departmentId: 'd1',
    });
    repo.departmentExistsInTenant.mockResolvedValue(true);

    repo.updateTemplate.mockResolvedValue({
      id: 'tpl1',
      name: 'Updated Name',
      updatedAt: new Date('2024-02-01T00:00:00Z'),
      milestones: [{ id: 'm1' }, { id: 'm2' }],
    });

    const result = await service.updateMilestoneTemplate(
      'd1',
      'tpl1',
      {
        name: 'Updated Name',
        milestones: [
          {
            sequence: 1,
            title: 'A',
            defaultDurationDays: 10,
            hasDeliverable: true,
            requiredDocuments: ['a.pdf'],
            isRequired: true,
          },
          {
            sequence: 2,
            title: 'B',
            defaultDurationDays: 5,
            hasDeliverable: false,
            requiredDocuments: [],
            isRequired: true,
          },
        ],
      },
      { sub: 'u1', tenantId: 't1' }
    );

    expect(repo.updateTemplate).toHaveBeenCalled();
    expect(result).toEqual({
      message: 'Milestone template updated successfully',
      templateId: 'tpl1',
      name: 'Updated Name',
      milestoneCount: 2,
      updatedAt: new Date('2024-02-01T00:00:00Z'),
    });
  });

  it('rejects duplicate sequence on update when milestones are provided', async () => {
    repo.findUserDepartmentContext.mockResolvedValue({
      id: 'u1',
      tenantId: 't1',
      departmentId: 'd1',
    });
    repo.departmentExistsInTenant.mockResolvedValue(true);

    await expect(
      service.updateMilestoneTemplate(
        'd1',
        'tpl1',
        {
          milestones: [
            {
              sequence: 1,
              title: 'A',
              defaultDurationDays: 10,
              hasDeliverable: true,
              requiredDocuments: ['a.pdf'],
              isRequired: true,
            },
            {
              sequence: 1,
              title: 'B',
              defaultDurationDays: 10,
              hasDeliverable: false,
              requiredDocuments: [],
              isRequired: true,
            },
          ],
        },
        { sub: 'u1', tenantId: 't1' }
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws NotFound when updating a missing template', async () => {
    repo.findUserDepartmentContext.mockResolvedValue({
      id: 'u1',
      tenantId: 't1',
      departmentId: 'd1',
    });
    repo.departmentExistsInTenant.mockResolvedValue(true);
    repo.updateTemplate.mockResolvedValue(null);

    await expect(
      service.updateMilestoneTemplate('d1', 'missing', { name: 'X' }, { sub: 'u1', tenantId: 't1' })
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletes a template and returns success message', async () => {
    repo.findUserDepartmentContext.mockResolvedValue({
      id: 'u1',
      tenantId: 't1',
      departmentId: 'd1',
    });
    repo.departmentExistsInTenant.mockResolvedValue(true);
    repo.deleteTemplate.mockResolvedValue({ deleted: true });

    const result = await service.deleteMilestoneTemplate('d1', 'tpl1', {
      sub: 'u1',
      tenantId: 't1',
    });
    expect(repo.deleteTemplate).toHaveBeenCalled();
    expect(result).toEqual({ message: 'Milestone template deleted successfully' });
  });

  it('throws NotFound when deleting a missing template', async () => {
    repo.findUserDepartmentContext.mockResolvedValue({
      id: 'u1',
      tenantId: 't1',
      departmentId: 'd1',
    });
    repo.departmentExistsInTenant.mockResolvedValue(true);
    repo.deleteTemplate.mockResolvedValue(null);

    await expect(
      service.deleteMilestoneTemplate('d1', 'missing', { sub: 'u1', tenantId: 't1' })
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
