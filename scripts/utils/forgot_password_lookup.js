/*
  Forgot-password debug lookup.
  Checks whether a tenant domain + email resolves to an ACTIVE user with a password.

  Usage:
    node scripts/utils/forgot_password_lookup.js --domain system --email admin@academia.et
*/

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

function getArg(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  const domain = (getArg('--domain') || '').trim().toLowerCase();
  const email = (getArg('--email') || '').trim();

  if (!domain || !email) {
    console.error('Missing args. Example: --domain system --email admin@academia.et');
    process.exitCode = 2;
    return;
  }

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
    const tenant = await prisma.tenant.findUnique({
      where: { domain },
      select: { id: true, domain: true, name: true, status: true },
    });

    if (!tenant) {
      console.log({ domain, tenantFound: false });
      return;
    }

    const user = await prisma.user.findFirst({
      where: { tenantId: tenant.id, email },
      select: {
        id: true,
        email: true,
        status: true,
        hashedPassword: true,
        tenantId: true,
      },
    });

    console.log({
      domain,
      tenantFound: true,
      tenant: { id: tenant.id, name: tenant.name, status: tenant.status },
      userFound: Boolean(user),
      user: user
        ? {
            id: user.id,
            email: user.email,
            status: user.status,
            hasPassword: Boolean(user.hashedPassword),
          }
        : null,
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Lookup failed:', err?.message || String(err));
  process.exitCode = 1;
});
