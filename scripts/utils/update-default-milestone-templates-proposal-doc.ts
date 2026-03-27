import { Prisma, PrismaClient } from '@prisma/client';

function normalizeTitle(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function ensureProposalPdf(value: unknown): string[] {
  const required = 'proposal.pdf';

  if (!Array.isArray(value)) {
    return [required];
  }

  const docs = value.filter((v) => typeof v === 'string') as string[];
  const has = docs.some((d) => d.trim().toLowerCase() === required);
  return has ? docs : [...docs, required];
}

async function main() {
  const prisma = new PrismaClient();

  try {
    const departments = await prisma.department.findMany({
      select: { id: true, tenantId: true, defaultMilestoneTemplateId: true },
      orderBy: { createdAt: 'asc' },
    });

    let scanned = 0;
    let updated = 0;
    let skippedNoDefault = 0;
    let skippedMissingMilestone1 = 0;
    let skippedTitleMismatch = 0;
    let alreadyOk = 0;

    for (const d of departments) {
      scanned += 1;

      if (!d.defaultMilestoneTemplateId) {
        skippedNoDefault += 1;
        continue;
      }

      const milestone1 = await prisma.milestoneTemplateMilestone.findUnique({
        where: {
          templateId_sequence: {
            templateId: d.defaultMilestoneTemplateId,
            sequence: 1,
          },
        },
        select: {
          templateId: true,
          sequence: true,
          title: true,
          requiredDocuments: true,
          hasDeliverable: true,
        },
      });

      if (!milestone1) {
        skippedMissingMilestone1 += 1;
        continue;
      }

      // Safety check: only update if it is still the "Project Proposal" step.
      if (normalizeTitle(milestone1.title) !== 'project proposal') {
        skippedTitleMismatch += 1;
        continue;
      }

      const nextDocs = ensureProposalPdf(milestone1.requiredDocuments);
      const nextHasDeliverable = true;

      const sameDocs =
        Array.isArray(milestone1.requiredDocuments) &&
        JSON.stringify(milestone1.requiredDocuments) === JSON.stringify(nextDocs);

      if (sameDocs && milestone1.hasDeliverable === nextHasDeliverable) {
        alreadyOk += 1;
        continue;
      }

      await prisma.milestoneTemplateMilestone.update({
        where: {
          templateId_sequence: {
            templateId: milestone1.templateId,
            sequence: milestone1.sequence,
          },
        },
        data: {
          requiredDocuments: nextDocs as unknown as Prisma.InputJsonValue,
          hasDeliverable: nextHasDeliverable,
        },
      });

      updated += 1;
    }

    // eslint-disable-next-line no-console
    console.log(
      [
        `Scanned: ${scanned}`,
        `Updated: ${updated}`,
        `Already OK: ${alreadyOk}`,
        `Skipped (no default template): ${skippedNoDefault}`,
        `Skipped (missing milestone #1): ${skippedMissingMilestone1}`,
        `Skipped (title mismatch): ${skippedTitleMismatch}`,
      ].join('\n')
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
