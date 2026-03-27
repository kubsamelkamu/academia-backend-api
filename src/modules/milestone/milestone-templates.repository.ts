import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ensureDepartmentDefaultMilestoneTemplate } from './default-department-milestone-template';

@Injectable()
export class MilestoneTemplatesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async ensureDepartmentDefaultTemplate(params: {
    tenantId: string;
    departmentId: string;
    createdById?: string;
  }) {
    const { tenantId, departmentId, createdById } = params;

    return this.prisma.$transaction(async (tx) => {
      return ensureDepartmentDefaultMilestoneTemplate({
        tx,
        tenantId,
        departmentId,
        createdById,
      });
    });
  }

  async findUserDepartmentContext(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, tenantId: true, departmentId: true },
    });
  }

  async departmentExistsInTenant(departmentId: string, tenantId: string) {
    const department = await this.prisma.department.findFirst({
      where: { id: departmentId, tenantId },
      select: { id: true },
    });

    return Boolean(department);
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
    isActive?: boolean;
    search?: string;
  }) {
    const { tenantId, departmentId, isActive, search } = params;

    return this.prisma.milestoneTemplate.count({
      where: {
        tenantId,
        departmentId,
        ...(typeof isActive === 'boolean' ? { isActive } : {}),
        ...(search
          ? {
              name: {
                contains: search,
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
    isActive?: boolean;
    search?: string;
    skip: number;
    take: number;
  }) {
    const { tenantId, departmentId, isActive, search, skip, take } = params;

    return this.prisma.milestoneTemplate.findMany({
      where: {
        tenantId,
        departmentId,
        ...(typeof isActive === 'boolean' ? { isActive } : {}),
        ...(search
          ? {
              name: {
                contains: search,
                mode: 'insensitive',
              },
            }
          : {}),
      },
      include: {
        milestones: {
          orderBy: { sequence: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  async getUsageCounts(params: { tenantId: string; departmentId: string; templateIds: string[] }) {
    const { tenantId, departmentId, templateIds } = params;

    if (templateIds.length === 0) return new Map<string, number>();

    const grouped = await this.prisma.project.groupBy({
      by: ['milestoneTemplateId'],
      where: {
        tenantId,
        departmentId,
        milestoneTemplateId: { in: templateIds },
      },
      _count: { _all: true },
    });

    const map = new Map<string, number>();
    for (const row of grouped) {
      if (row.milestoneTemplateId) {
        map.set(row.milestoneTemplateId, row._count._all);
      }
    }
    return map;
  }

  async createTemplate(params: {
    tenantId: string;
    departmentId: string;
    name: string;
    description?: string;
    isActive: boolean;
    createdById?: string;
    milestones: Array<{
      sequence: number;
      title: string;
      description?: string;
      defaultDurationDays: number;
      hasDeliverable: boolean;
      requiredDocuments?: string[];
      isRequired: boolean;
    }>;
  }) {
    const { tenantId, departmentId, name, description, isActive, createdById, milestones } = params;

    return this.prisma.milestoneTemplate.create({
      data: {
        tenantId,
        departmentId,
        name,
        description,
        isActive,
        createdById,
        milestones: {
          create: milestones.map((m) => ({
            sequence: m.sequence,
            title: m.title,
            description: m.description,
            defaultDurationDays: m.defaultDurationDays,
            hasDeliverable: m.hasDeliverable,
            requiredDocuments: m.requiredDocuments ?? undefined,
            isRequired: m.isRequired,
          })),
        },
      },
      include: { milestones: true },
    });
  }

  async findTemplateById(params: { tenantId: string; departmentId: string; templateId: string }) {
    const { tenantId, departmentId, templateId } = params;

    return this.prisma.milestoneTemplate.findFirst({
      where: {
        id: templateId,
        tenantId,
        departmentId,
      },
      include: {
        milestones: {
          orderBy: { sequence: 'asc' },
        },
      },
    });
  }

  async updateTemplate(params: {
    tenantId: string;
    departmentId: string;
    templateId: string;
    data: {
      name?: string;
      description?: string;
      isActive?: boolean;
    };
    milestones?: Array<{
      sequence: number;
      title: string;
      description?: string;
      defaultDurationDays: number;
      hasDeliverable: boolean;
      requiredDocuments?: string[];
      isRequired: boolean;
    }>;
  }) {
    const { tenantId, departmentId, templateId, data, milestones } = params;

    // Ensure ownership scope first
    const existing = await this.findTemplateById({ tenantId, departmentId, templateId });
    if (!existing) return null;

    return this.prisma.milestoneTemplate.update({
      where: { id: templateId },
      data: {
        ...data,
        ...(milestones
          ? {
              milestones: {
                deleteMany: {},
                create: milestones.map((m) => ({
                  sequence: m.sequence,
                  title: m.title,
                  description: m.description,
                  defaultDurationDays: m.defaultDurationDays,
                  hasDeliverable: m.hasDeliverable,
                  requiredDocuments: m.requiredDocuments ?? undefined,
                  isRequired: m.isRequired,
                })),
              },
            }
          : {}),
      },
      include: {
        milestones: {
          orderBy: { sequence: 'asc' },
        },
      },
    });
  }

  async deleteTemplate(params: { tenantId: string; departmentId: string; templateId: string }) {
    const { tenantId, departmentId, templateId } = params;

    const existing = await this.findTemplateById({ tenantId, departmentId, templateId });
    if (!existing) return null;

    await this.prisma.milestoneTemplate.delete({ where: { id: templateId } });
    return { deleted: true };
  }
}
