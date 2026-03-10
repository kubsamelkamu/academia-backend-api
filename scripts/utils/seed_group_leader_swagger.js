const path = require('path');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const { PrismaClient, TenantStatus, UserStatus } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

dotenv.config({ path: path.resolve(process.cwd(), `.env.${process.env.NODE_ENV || 'development'}`) });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(`${name} is required in your env`);
  }
  return String(value).trim();
}

async function hashPassword(password) {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  const isProduction = process.env.NODE_ENV === 'production';
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: isProduction ? { rejectUnauthorized: false } : undefined,
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const platformAdminEmail = (process.env.PLATFORM_ADMIN_EMAIL || 'admin@academia.et').trim();
  const platformAdminPassword = (process.env.PLATFORM_ADMIN_PASSWORD || 'Admin@1234').trim();

  const demoTenantDomain = (process.env.DEMO_TENANT_DOMAIN || 'demo').trim().toLowerCase();
  const demoTenantName = (process.env.DEMO_TENANT_NAME || 'Demo University').trim();

  const departmentCode = (process.env.DEMO_DEPARTMENT_CODE || 'CS').trim().toUpperCase();
  const departmentName = (process.env.DEMO_DEPARTMENT_NAME || 'Computer Science').trim();

  const deptHeadEmail = (process.env.DEMO_DEPT_HEAD_EMAIL || 'depthead@demo.et').trim().toLowerCase();
  const deptHeadPassword = (process.env.DEMO_DEPT_HEAD_PASSWORD || 'DeptHead@1234').trim();

  const studentEmail = (process.env.DEMO_STUDENT_EMAIL || 'student1@demo.et').trim().toLowerCase();
  const studentPassword = (process.env.DEMO_STUDENT_PASSWORD || 'Student@1234').trim();

  try {
    console.log('🌱 Seeding minimal data for Swagger group-leader-request flow...');

    // Ensure system tenant
    const systemTenant = await prisma.tenant.upsert({
      where: { domain: 'system' },
      update: {
        name: 'System',
        status: TenantStatus.ACTIVE,
        config: { isSystemTenant: true },
      },
      create: {
        name: 'System',
        domain: 'system',
        status: TenantStatus.ACTIVE,
        config: { isSystemTenant: true },
      },
    });

    // Ensure roles exist
    const roleNames = [
      'PlatformAdmin',
      'DepartmentHead',
      'Advisor',
      'Coordinator',
      'DepartmentCommittee',
      'Student',
    ];

    const rolesByName = {};
    for (const roleName of roleNames) {
      rolesByName[roleName] = await prisma.role.upsert({
        where: { name: roleName },
        update: {
          description: `${roleName} role`,
          isSystemRole: true,
        },
        create: {
          name: roleName,
          description: `${roleName} role`,
          isSystemRole: true,
        },
      });
    }

    // Platform admin (optional but useful for other testing)
    const platformAdminUser = await prisma.user.upsert({
      where: {
        tenantId_email: { tenantId: systemTenant.id, email: platformAdminEmail },
      },
      update: {
        status: UserStatus.ACTIVE,
        emailVerified: true,
      },
      create: {
        tenantId: systemTenant.id,
        email: platformAdminEmail,
        hashedPassword: await hashPassword(platformAdminPassword),
        firstName: 'Platform',
        lastName: 'Admin',
        status: UserStatus.ACTIVE,
        emailVerified: true,
      },
    });

    await prisma.userRole.upsert({
      where: {
        userId_roleId_tenantId: {
          userId: platformAdminUser.id,
          roleId: rolesByName.PlatformAdmin.id,
          tenantId: systemTenant.id,
        },
      },
      update: { assignedAt: new Date(), revokedAt: null },
      create: {
        userId: platformAdminUser.id,
        roleId: rolesByName.PlatformAdmin.id,
        tenantId: systemTenant.id,
        assignedAt: new Date(),
      },
    });

    // Demo tenant
    const demoTenant = await prisma.tenant.upsert({
      where: { domain: demoTenantDomain },
      update: {
        name: demoTenantName,
        status: TenantStatus.ACTIVE,
      },
      create: {
        name: demoTenantName,
        domain: demoTenantDomain,
        status: TenantStatus.ACTIVE,
      },
    });

    // Demo department
    const demoDepartment = await prisma.department.upsert({
      where: { tenantId_code: { tenantId: demoTenant.id, code: departmentCode } },
      update: { name: departmentName },
      create: {
        tenantId: demoTenant.id,
        name: departmentName,
        code: departmentCode,
      },
    });

    // Department head
    const deptHeadUser = await prisma.user.upsert({
      where: {
        tenantId_email: { tenantId: demoTenant.id, email: deptHeadEmail },
      },
      update: {
        status: UserStatus.ACTIVE,
        emailVerified: true,
        departmentId: demoDepartment.id,
      },
      create: {
        tenantId: demoTenant.id,
        email: deptHeadEmail,
        hashedPassword: await hashPassword(deptHeadPassword),
        firstName: 'Dept',
        lastName: 'Head',
        status: UserStatus.ACTIVE,
        emailVerified: true,
        departmentId: demoDepartment.id,
      },
    });

    await prisma.userRole.upsert({
      where: {
        userId_roleId_tenantId: {
          userId: deptHeadUser.id,
          roleId: rolesByName.DepartmentHead.id,
          tenantId: demoTenant.id,
        },
      },
      update: {
        assignedAt: new Date(),
        revokedAt: null,
        departmentId: demoDepartment.id,
      },
      create: {
        userId: deptHeadUser.id,
        roleId: rolesByName.DepartmentHead.id,
        tenantId: demoTenant.id,
        departmentId: demoDepartment.id,
        assignedAt: new Date(),
      },
    });

    // Link department head
    await prisma.department.update({
      where: { id: demoDepartment.id },
      data: { headOfDepartmentId: deptHeadUser.id },
    });

    // Student
    const studentUser = await prisma.user.upsert({
      where: {
        tenantId_email: { tenantId: demoTenant.id, email: studentEmail },
      },
      update: {
        status: UserStatus.ACTIVE,
        emailVerified: true,
        departmentId: demoDepartment.id,
      },
      create: {
        tenantId: demoTenant.id,
        email: studentEmail,
        hashedPassword: await hashPassword(studentPassword),
        firstName: 'Student',
        lastName: 'One',
        status: UserStatus.ACTIVE,
        emailVerified: true,
        departmentId: demoDepartment.id,
      },
    });

    await prisma.userRole.upsert({
      where: {
        userId_roleId_tenantId: {
          userId: studentUser.id,
          roleId: rolesByName.Student.id,
          tenantId: demoTenant.id,
        },
      },
      update: {
        assignedAt: new Date(),
        revokedAt: null,
        departmentId: demoDepartment.id,
      },
      create: {
        userId: studentUser.id,
        roleId: rolesByName.Student.id,
        tenantId: demoTenant.id,
        departmentId: demoDepartment.id,
        assignedAt: new Date(),
      },
    });

    await prisma.student.upsert({
      where: { userId: studentUser.id },
      update: {},
      create: {
        tenantId: demoTenant.id,
        userId: studentUser.id,
      },
    });

    console.log('✅ Seed complete. Use these credentials in Swagger:');
    console.log(`Platform Admin: ${platformAdminEmail} / ${platformAdminPassword} (tenantDomain: system)`);
    console.log(`Department Head: ${deptHeadEmail} / ${deptHeadPassword} (tenantDomain: ${demoTenantDomain})`);
    console.log(`Student: ${studentEmail} / ${studentPassword} (tenantDomain: ${demoTenantDomain})`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error('❌ Seed failed:', e);
  process.exit(1);
});
