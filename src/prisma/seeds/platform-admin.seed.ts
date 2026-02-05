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

  // Check if Platform Admin role exists
  let platformAdminRole = await prisma.role.findUnique({
    where: { name: 'PlatformAdmin' },
  });

  if (!platformAdminRole) {
    platformAdminRole = await prisma.role.create({
      data: {
        name: 'PlatformAdmin',
        description: 'System-wide platform administrator',
        permissions: {
          canManageAllTenants: true,
          canCreateTenants: true,
          canManageSubscriptionPlans: true,
          canViewAllData: true,
        },
        isSystemRole: true,
      },
    });
    console.log('✅ Created PlatformAdmin role');
  }

  // Create other system roles
  const systemRoles = [
    'DepartmentHead',
    'Advisor',
    'Coordinator',
    'DepartmentCommittee',
    'Student',
  ];

  for (const roleName of systemRoles) {
    const existingRole = await prisma.role.findUnique({
      where: { name: roleName },
    });

    if (!existingRole) {
      await prisma.role.create({
        data: {
          name: roleName,
          description: `${roleName} role`,
          isSystemRole: true,
        },
      });
      console.log(`✅ Created ${roleName} role`);
    }
  }

  // Check if Platform Admin user exists
  const { email: adminEmail, password: adminPassword } = getPlatformAdminCredentials();
  let adminUser = await prisma.user.findFirst({
    where: { tenantId: systemTenant.id, email: adminEmail },
  });

  if (!adminUser) {
    const hashedPassword = await hashPassword(adminPassword);

    // Create Platform Admin user (system tenant)
    adminUser = await prisma.user.create({
      data: {
        tenant: { connect: { id: systemTenant.id } },
        email: adminEmail,
        hashedPassword,
        firstName: 'Platform',
        lastName: 'Admin',
        status: UserStatus.ACTIVE,
        emailVerified: true,
      },
    });
    console.log('✅ Created Platform Admin user');
    console.log(`   Email: ${adminEmail}`);
    if (process.env.NODE_ENV === 'development' && !process.env.PLATFORM_ADMIN_PASSWORD) {
      console.log(`   Password: ${adminPassword}`);
      console.log('   ⚠️  CHANGE THIS PASSWORD IMMEDIATELY!');
    }
  }

  // Assign PlatformAdmin role to the user
  const existingAssignment = await prisma.userRole.findFirst({
    where: {
      userId: adminUser.id,
      roleId: platformAdminRole.id,
    },
  });

  if (!existingAssignment) {
    await prisma.userRole.create({
      data: {
        userId: adminUser.id,
        roleId: platformAdminRole.id,
        tenantId: systemTenant.id,
        assignedAt: new Date(),
      },
    });
    console.log('✅ Assigned PlatformAdmin role to user');
  }

  // Seed subscription plans
  await seedSubscriptionPlans();

  console.log('🎉 Platform Admin seeding complete!');
}

async function seedSubscriptionPlans() {
  console.log('💰 Seeding subscription plans...');

  const plans = [
    {
      name: 'Free',
      description: 'Free plan for small institutions',
      features: {
        maxUsers: 100,
        maxDepartments: 1,
        storageGB: 5,
        customRubrics: false,
        bulkImport: false,
        apiAccess: false,
        prioritySupport: false,
      },
      price: new Prisma.Decimal(0),
      billingCycle: 'monthly',
      isActive: true,
    },
    {
      name: 'Premium',
      description: 'Premium plan for larger institutions',
      features: {
        maxUsers: 300,
        maxDepartments: 10,
        storageGB: 50,
        customRubrics: true,
        bulkImport: true,
        apiAccess: true,
        prioritySupport: true,
      },
      price: new Prisma.Decimal(99),
      billingCycle: 'monthly',
      isActive: true,
    },
  ];

  for (const planData of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { name: planData.name },
      update: {},
      create: planData,
    });
    console.log(`✅ Created/Updated ${planData.name} plan`);
  }
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
