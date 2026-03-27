export const DEFAULT_DEPARTMENT_MILESTONE_TEMPLATE = {
  name: 'Default Department Milestones',
  description: 'Platform default 5-step milestone template',
  isActive: true,
  milestones: [
    {
      sequence: 1,
      title: 'Project Proposal',
      description: 'Submit proposal',
      defaultDurationDays: 7,
      hasDeliverable: true,
      requiredDocuments: ['proposal.pdf'],
      isRequired: true,
    },
    {
      sequence: 2,
      title: 'Software Requirements Specification (SRS)',
      description: 'Submit SRS document',
      defaultDurationDays: 63,
      hasDeliverable: true,
      requiredDocuments: ['SRS.pdf'],
      isRequired: true,
    },
    {
      sequence: 3,
      title: 'System Design Document (SDD)',
      description: 'Submit system design document',
      defaultDurationDays: 60,
      hasDeliverable: true,
      requiredDocuments: ['SDD.pdf'],
      isRequired: true,
    },
    {
      sequence: 4,
      title: 'Implementation & Testing Report',
      description: 'Submit implementation & testing report',
      defaultDurationDays: 14,
      hasDeliverable: true,
      requiredDocuments: ['Implementation.md'],
      isRequired: true,
    },
    {
      sequence: 5,
      title: 'Final Defense',
      description: 'Final defense',
      defaultDurationDays: 14,
      hasDeliverable: false,
      requiredDocuments: [] as string[],
      isRequired: true,
    },
  ],
} as const;

export async function ensureDepartmentDefaultMilestoneTemplate(params: {
  tx: any;
  tenantId: string;
  departmentId: string;
  createdById?: string;
}): Promise<string> {
  const { tx, tenantId, departmentId, createdById } = params;

  const department = await tx.department.findUnique({
    where: { id: departmentId },
    select: { id: true, tenantId: true, defaultMilestoneTemplateId: true },
  });

  if (!department || department.tenantId !== tenantId) {
    throw new Error('Department not found');
  }

  if (department.defaultMilestoneTemplateId) {
    const existing = await tx.milestoneTemplate.findFirst({
      where: {
        id: department.defaultMilestoneTemplateId,
        tenantId,
        departmentId,
      },
      select: { id: true },
    });

    if (existing?.id) {
      return existing.id;
    }
  }

  const template = await tx.milestoneTemplate.create({
    data: {
      tenantId,
      departmentId,
      name: DEFAULT_DEPARTMENT_MILESTONE_TEMPLATE.name,
      description: DEFAULT_DEPARTMENT_MILESTONE_TEMPLATE.description,
      isActive: DEFAULT_DEPARTMENT_MILESTONE_TEMPLATE.isActive,
      createdById: createdById ?? null,
      milestones: {
        create: DEFAULT_DEPARTMENT_MILESTONE_TEMPLATE.milestones.map((m) => ({
          sequence: m.sequence,
          title: m.title,
          description: m.description,
          defaultDurationDays: m.defaultDurationDays,
          hasDeliverable: m.hasDeliverable,
          requiredDocuments: m.requiredDocuments,
          isRequired: m.isRequired,
        })),
      },
    },
    select: { id: true },
  });

  await tx.department.update({
    where: { id: departmentId },
    data: { defaultMilestoneTemplateId: template.id },
  });

  return template.id;
}
