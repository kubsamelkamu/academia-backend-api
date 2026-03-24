import { seedPlatformAdmin } from './platform-admin.seed';
import { MissingDatabaseUrlException } from '../../common/exceptions';

if (!process.env.DATABASE_URL) {
  throw new MissingDatabaseUrlException();
}

async function main() {
  console.log('🌱 Starting database seeding...');
  await seedPlatformAdmin();
  console.log('🎉 Database seeding completed!');
}

main().catch(console.error);
