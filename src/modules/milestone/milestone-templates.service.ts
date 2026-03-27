import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { MilestoneTemplate, MilestoneTemplateMilestone } from '@prisma/client';
import { MilestoneTemplatesRepository } from './milestone-templates.repository';
import {
  CreateMilestoneTemplateDto,
  ListMilestoneTemplatesQueryDto,
  UpdateMilestoneTemplateDto,
} from './dto';
import { NotificationService } from '../notification/notification.service';

type TemplateWithMilestones = MilestoneTemplate & { milestones: MilestoneTemplateMilestone[] };

@Injectable()
export class MilestoneTemplatesService {
  private readonly logger = new Logger(MilestoneTemplatesService.name);

  constructor(
    private readonly milestoneTemplatesRepository: MilestoneTemplatesRepository,
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

    const ctx = await this.milestoneTemplatesRepository.findUserDepartmentContext(user.sub);
    if (!ctx?.departmentId) {
      throw new ForbiddenException('User is not assigned to a department');
    }

    if (ctx.tenantId !== tenantId) {
      throw new ForbiddenException('Invalid tenant context');
    }

    if (ctx.departmentId !== departmentId) {
      throw new ForbiddenException('Access denied to department');
    }

    const ok = await this.milestoneTemplatesRepository.departmentExistsInTenant(
      departmentId,
      tenantId
    );
    if (!ok) {
      throw new ForbiddenException('Department not found for tenant');
    }

    return { tenantId };
  }

  async listMilestoneTemplates(
    departmentId: string,
    query: ListMilestoneTemplatesQueryDto,
    user: any
  ) {
    const { tenantId } = await this.assertDepartmentAccess(user, departmentId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const shouldAutoEnsureDefault =
      !query.search && typeof query.isActive !== 'boolean' && page === 1;

    let total = await this.milestoneTemplatesRepository.countTemplates({
      tenantId,
      departmentId,
      isActive: query.isActive,
      search: query.search,
    });

    if (shouldAutoEnsureDefault && total === 0) {
      await this.milestoneTemplatesRepository.ensureDepartmentDefaultTemplate({
        tenantId,
        departmentId,
        createdById: user?.sub,
      });

      total = await this.milestoneTemplatesRepository.countTemplates({
        tenantId,
        departmentId,
      });
    }

    const templates = (await this.milestoneTemplatesRepository.findTemplates({
      tenantId,
      departmentId,
      isActive: query.isActive,
      search: query.search,
      skip,
      take: limit,
    })) as TemplateWithMilestones[];

    const usageMap = await this.milestoneTemplatesRepository.getUsageCounts({
      tenantId,
      departmentId,
      templateIds: templates.map((t) => t.id),
    });

    return {
      templates: templates.map((t) => ({
        templateId: t.id,
        name: t.name,
        description: t.description,
        milestones: t.milestones
          .slice()
          .sort((a, b) => a.sequence - b.sequence)
          .map((m) => ({
            sequence: m.sequence,
            title: m.title,
            description: m.description,
            defaultDurationDays: m.defaultDurationDays,
            hasDeliverable: m.hasDeliverable,
            requiredDocuments: (m.requiredDocuments as string[] | null) ?? [],
            isRequired: m.isRequired,
          })),
        isActive: t.isActive,
        createdAt: t.createdAt,
        usageCount: usageMap.get(t.id) ?? 0,
      })),
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async createMilestoneTemplate(departmentId: string, dto: CreateMilestoneTemplateDto, user: any) {
    const { tenantId } = await this.assertDepartmentAccess(user, departmentId);

    const sequences = dto.milestones.map((m) => m.sequence);
    const unique = new Set(sequences);
    if (unique.size !== sequences.length) {
      throw new BadRequestException('Milestone sequence values must be unique within a template');
    }

    const milestones = dto.milestones
      .slice()
      .sort((a, b) => a.sequence - b.sequence)
      .map((m) => ({
        sequence: m.sequence,
        title: m.title,
        description: m.description,
        defaultDurationDays: m.defaultDurationDays,
        hasDeliverable: m.hasDeliverable,
        requiredDocuments: m.requiredDocuments,
        isRequired: m.isRequired ?? true,
      }));

    const saved = await this.milestoneTemplatesRepository.createTemplate({
      tenantId,
      departmentId,
      name: dto.name,
      description: dto.description,
      isActive: dto.isActive ?? true,
      createdById: user?.sub,
      milestones,
    });

    // Best-effort notification (do not block creation)
    try {
      const department = await this.milestoneTemplatesRepository.findDepartmentById(departmentId);
      if (!department) {
        this.logger.warn(`MilestoneTemplateNotification: department not found (${departmentId})`);
      } else if (department.tenantId !== tenantId) {
        this.logger.warn(
          `MilestoneTemplateNotification: tenant mismatch (departmentId=${departmentId})`
        );
      } else {
        const userIds = await this.milestoneTemplatesRepository.findDepartmentUserIds(
          departmentId,
          tenantId
        );

        await this.notificationService.notifyMilestoneTemplateCreated({
          tenantId,
          userIds,
          departmentId,
          departmentName: department.name ?? undefined,
          templateId: saved.id,
          templateName: saved.name,
          milestoneCount: saved.milestones.length,
          actorUserId: user?.sub,
        });
      }
    } catch (err: any) {
      this.logger.warn(
        `MilestoneTemplateNotification: failed (${err?.message ?? 'unknown error'})`
      );
    }

    return {
      message: 'Milestone template created successfully',
      templateId: saved.id,
      name: saved.name,
      milestoneCount: saved.milestones.length,
      createdAt: saved.createdAt,
    };
  }

  async updateMilestoneTemplate(
    departmentId: string,
    templateId: string,
    dto: UpdateMilestoneTemplateDto,
    user: any
  ) {
    const { tenantId } = await this.assertDepartmentAccess(user, departmentId);

    let milestones:
      | Array<{
          sequence: number;
          title: string;
          description?: string;
          defaultDurationDays: number;
          hasDeliverable: boolean;
          requiredDocuments?: string[];
          isRequired: boolean;
        }>
      | undefined;

    if (dto.milestones) {
      const sequences = dto.milestones.map((m) => m.sequence);
      const unique = new Set(sequences);
      if (unique.size !== sequences.length) {
        throw new BadRequestException('Milestone sequence values must be unique within a template');
      }

      milestones = dto.milestones
        .slice()
        .sort((a, b) => a.sequence - b.sequence)
        .map((m) => ({
          sequence: m.sequence,
          title: m.title,
          description: m.description,
          defaultDurationDays: m.defaultDurationDays,
          hasDeliverable: m.hasDeliverable,
          requiredDocuments: m.requiredDocuments,
          isRequired: m.isRequired ?? true,
        }));
    }

    const updated = await this.milestoneTemplatesRepository.updateTemplate({
      tenantId,
      departmentId,
      templateId,
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      milestones,
    });

    if (!updated) {
      throw new NotFoundException('Milestone template not found');
    }

    return {
      message: 'Milestone template updated successfully',
      templateId: updated.id,
      name: updated.name,
      milestoneCount: updated.milestones.length,
      updatedAt: updated.updatedAt,
    };
  }

  async deleteMilestoneTemplate(departmentId: string, templateId: string, user: any) {
    const { tenantId } = await this.assertDepartmentAccess(user, departmentId);

    const deleted = await this.milestoneTemplatesRepository.deleteTemplate({
      tenantId,
      departmentId,
      templateId,
    });

    if (!deleted) {
      throw new NotFoundException('Milestone template not found');
    }

    return {
      message: 'Milestone template deleted successfully',
    };
  }
}
