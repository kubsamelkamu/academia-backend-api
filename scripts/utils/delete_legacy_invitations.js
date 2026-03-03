/*
  Delete legacy invitations that were created before inviter-provided names were required.
  These legacy rows typically have inviteeFirstName/inviteeLastName = null and will be rejected
  by the new token-only accept flow.

  Usage (dry-run by default):
    node scripts/utils/delete_legacy_invitations.js

  Apply deletion:
    node scripts/utils/delete_legacy_invitations.js --apply

  Optional scoping:
    node scripts/utils/delete_legacy_invitations.js --apply --tenantId <uuid>
    node scripts/utils/delete_legacy_invitations.js --apply --departmentId <uuid>

  Notes:
  - This script deletes only PENDING invitations missing invited names.
  - Intended for local/dev cleanup.
*/

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function getArg(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  const apply = hasFlag('--apply');
  const tenantId = getArg('--tenantId');
  const departmentId = getArg('--departmentId');

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('Missing DATABASE_URL in .env');
    process.exitCode = 2;
    return;
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: isProduction ? { rejectUnauthorized: false } : undefined,
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const where = {
      status: 'PENDING',
      OR: [{ inviteeFirstName: null }, { inviteeLastName: null }],
      ...(tenantId ? { tenantId } : {}),
      ...(departmentId ? { departmentId } : {}),
    };

    const count = await prisma.invitation.count({ where });

    console.log({
      mode: apply ? 'apply' : 'dry-run',
      criteria: {
        status: 'PENDING',
        missingNames: true,
        tenantId: tenantId || null,
        departmentId: departmentId || null,
      },
      matched: count,
    });

    if (!apply) {
      console.log('Dry-run only. Re-run with --apply to delete.');
      return;
    }

    const result = await prisma.invitation.deleteMany({ where });
    console.log({ deleted: result.count });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Delete legacy invitations failed:', err?.message || String(err));
  process.exitCode = 1;
});
