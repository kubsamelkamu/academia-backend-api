import { PrismaClient } from '@prisma/client';
import { ensureDepartmentDefaultMilestoneTemplate } from '../../src/modules/milestone/default-department-milestone-template';

async function main() {
  const prisma = new PrismaClient();

  try {
    const departments = await prisma.department.findMany({
      select: { id: true, tenantId: true, defaultMilestoneTemplateId: true },
      orderBy: { createdAt: 'asc' },
    });

    let ensured = 0;
    for (const d of departments) {
      await prisma.$transaction(async (tx) => {
        await ensureDepartmentDefaultMilestoneTemplate({
          tx,
          tenantId: d.tenantId,
          departmentId: d.id,
        });
      });

      ensured += 1;
    }

    // eslint-disable-next-line no-console
    console.log(`Default milestone templates ensured for ${ensured} department(s).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
