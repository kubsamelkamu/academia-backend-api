/*
  Invitation debug lookup.
  Finds an invitation and prints token + accept URLs.

  Usage:
    node scripts/utils/invitation_lookup.js --invitationId <uuid>

    node scripts/utils/invitation_lookup.js --tenantDomain <domain> --email <email> --roleName <RoleName>
    node scripts/utils/invitation_lookup.js --tenantDomain <domain> --email <email> --roleName <RoleName> --latest

  Examples:
    node scripts/utils/invitation_lookup.js --tenantDomain system --email admin@academia.et --roleName DepartmentHead --latest
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

function hasFlag(name) {
  return process.argv.includes(name);
}

function normalizeRoleName(roleName) {
  if (!roleName) return undefined;
  // Stored roleName values in this repo look like: DepartmentHead, Student, Advisor...
  return String(roleName).trim();
}

async function main() {
  const invitationId = (getArg('--invitationId') || '').trim();
  const tenantDomain = (getArg('--tenantDomain') || '').trim().toLowerCase();
  const email = (getArg('--email') || '').trim().toLowerCase();
  const roleName = normalizeRoleName(getArg('--roleName'));
  const latest = hasFlag('--latest');

  if (!invitationId && (!tenantDomain || !email || !roleName)) {
    console.error(
      'Missing args. Provide either --invitationId, or (--tenantDomain --email --roleName).\n' +
        'Example: node scripts/utils/invitation_lookup.js --tenantDomain system --email admin@academia.et --roleName DepartmentHead --latest'
    );
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

  const apiBaseUrl = (process.env.APP_URL || process.env.API_URL || 'http://localhost:3001')
    .replace(/\/+$/, '');
  const apiAcceptUrl = (token) => `${apiBaseUrl}/api/v1/invitations/accept`;

  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');
  const frontendAcceptUrl = (token) => `${frontendUrl}/invitations/accept?token=${token}`;

  try {
    let invitation;

    if (invitationId) {
      invitation = await prisma.invitation.findUnique({
        where: { id: invitationId },
        select: {
          id: true,
          tenantId: true,
          departmentId: true,
          email: true,
          roleName: true,
          status: true,
          token: true,
          expiresAt: true,
          createdAt: true,
          acceptedAt: true,
          revokedAt: true,
          lastSentAt: true,
          sendCount: true,
          lastSendError: true,
        },
      });

      if (!invitation) {
        console.log({ invitationFound: false, invitationId });
        return;
      }
    } else {
      const tenant = await prisma.tenant.findUnique({
        where: { domain: tenantDomain },
        select: { id: true, domain: true, name: true, status: true },
      });

      if (!tenant) {
        console.log({ tenantFound: false, tenantDomain });
        return;
      }

      const where = {
        tenantId: tenant.id,
        email,
        roleName,
      };

      invitation = await prisma.invitation.findFirst({
        where,
        orderBy: latest ? [{ createdAt: 'desc' }] : undefined,
        select: {
          id: true,
          tenantId: true,
          departmentId: true,
          email: true,
          roleName: true,
          status: true,
          token: true,
          expiresAt: true,
          createdAt: true,
          acceptedAt: true,
          revokedAt: true,
          lastSentAt: true,
          sendCount: true,
          lastSendError: true,
        },
      });

      if (!invitation) {
        console.log({
          tenantFound: true,
          tenant: { id: tenant.id, domain: tenant.domain, name: tenant.name, status: tenant.status },
          invitationFound: false,
          query: { tenantDomain, email, roleName, latest },
        });
        return;
      }

      console.log({
        tenantFound: true,
        tenant: { id: tenant.id, domain: tenant.domain, name: tenant.name, status: tenant.status },
      });
    }

    console.log({
      invitationFound: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        roleName: invitation.roleName,
        status: invitation.status,
        tenantId: invitation.tenantId,
        departmentId: invitation.departmentId,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
        acceptedAt: invitation.acceptedAt,
        revokedAt: invitation.revokedAt,
        lastSentAt: invitation.lastSentAt,
        sendCount: invitation.sendCount,
        lastSendError: invitation.lastSendError,
      },
      token: invitation.token,
      accept: {
        api: {
          url: apiAcceptUrl(invitation.token),
          body: {
            token: invitation.token,
            firstName: 'Test',
            lastName: 'User',
          },
        },
        frontend: {
          url: frontendAcceptUrl(invitation.token),
        },
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Lookup failed:', err?.message || String(err));
  process.exitCode = 1;
});
