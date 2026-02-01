import { seedPlatformAdmin } from './platform-admin.seed';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required to run database seeds');
}

async function main() {
  console.log('🌱 Starting database seeding...');
  await seedPlatformAdmin();
  console.log('🎉 Database seeding completed!');
}

main().catch(console.error);
