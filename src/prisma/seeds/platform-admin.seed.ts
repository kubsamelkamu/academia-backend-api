import * as path from 'path';
import * as dotenv from 'dotenv';
import { Prisma, TenantStatus, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma.service';
import { MissingPlatformAdminPasswordException } from '../../common/exceptions';

dotenv.config({
  path: path.resolve(process.cwd(), `.env.${process.env.NODE_ENV || 'development'}`),
});
dotenv.config({
  path: path.resolve(process.cwd(), '.env'),
});

const prisma = new PrismaService();

async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

function getPlatformAdminCredentials() {
  const email = (process.env.PLATFORM_ADMIN_EMAIL || 'admin@academia.et').trim();
  const passwordFromEnv = process.env.PLATFORM_ADMIN_PASSWORD;

  if (passwordFromEnv && passwordFromEnv.trim().length > 0) {
    return { email, password: passwordFromEnv };
  }

  if (process.env.NODE_ENV === 'development') {
    return { email, password: 'Admin@1234' };
  }

  throw new MissingPlatformAdminPasswordException();
}

export async function seedPlatformAdmin() {
  console.log('🌱 Seeding Platform Admin...');

  // Schema requires a tenant for every user; keep a dedicated system tenant.
  const systemTenant = await prisma.tenant.upsert({
    where: { domain: 'system' },
    update: {
      name: 'System',
      status: TenantStatus.ACTIVE,
      config: {
        isSystemTenant: true,
      },
    },
    create: {
      name: 'System',
      domain: 'system',
      status: TenantStatus.ACTIVE,
      config: {
        isSystemTenant: true,
      },
    },
  });

  // Ensure Platform Admin role exists
  const platformAdminRole = await prisma.role.upsert({
    where: { name: 'PlatformAdmin' },
    update: {
      description: 'System-wide platform administrator',
      permissions: {
        canManageAllTenants: true,
        canCreateTenants: true,
        canViewAllData: true,
      },
      isSystemRole: true,
    },
    create: {
      name: 'PlatformAdmin',
      description: 'System-wide platform administrator',
      permissions: {
        canManageAllTenants: true,
        canCreateTenants: true,
        canViewAllData: true,
      },
      isSystemRole: true,
    },
  });
  console.log('✅ Ensured PlatformAdmin role exists');

  // Ensure other system roles exist
  const systemRoles = [
    'DepartmentHead',
    'Advisor',
    'Coordinator',
    'DepartmentCommittee',
    'Student',
  ];

  for (const roleName of systemRoles) {
    await prisma.role.upsert({
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
    console.log(`✅ Ensured ${roleName} role exists`);
  }

  // Ensure Platform Admin user exists
  const { email: adminEmail, password: adminPassword } = getPlatformAdminCredentials();
  const hashedPassword = await hashPassword(adminPassword);

  const adminUser = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: systemTenant.id,
        email: adminEmail,
      },
    },
    update: {
      status: UserStatus.ACTIVE,
      emailVerified: true,
    },
    create: {
      tenant: { connect: { id: systemTenant.id } },
      email: adminEmail,
      hashedPassword,
      firstName: 'Platform',
      lastName: 'Admin',
      status: UserStatus.ACTIVE,
      emailVerified: true,
    },
  });
  console.log('✅ Ensured Platform Admin user exists');
  console.log(`   Email: ${adminEmail}`);
  if (process.env.NODE_ENV === 'development' && !process.env.PLATFORM_ADMIN_PASSWORD) {
    console.log(`   Password: ${adminPassword}`);
    console.log('   ⚠️  CHANGE THIS PASSWORD IMMEDIATELY!');
  }

  // Ensure PlatformAdmin role is assigned to the user
  await prisma.userRole.upsert({
    where: {
      userId_roleId_tenantId: {
        userId: adminUser.id,
        roleId: platformAdminRole.id,
        tenantId: systemTenant.id,
      },
    },
    update: {
      assignedAt: new Date(),
    },
    create: {
      userId: adminUser.id,
      roleId: platformAdminRole.id,
      tenantId: systemTenant.id,
      assignedAt: new Date(),
    },
  });
  console.log('✅ Ensured PlatformAdmin role is assigned to user');

  console.log('🎉 Platform Admin seeding complete!');
}

// Execute seeding
seedPlatformAdmin()
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
