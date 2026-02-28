require('dotenv').config({ path: '.env.development' });

const { Client } = require('pg');

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('Missing DATABASE_URL (expected in .env.development)');
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const result = await client.query(
    "select e.enumlabel from pg_enum e join pg_type t on e.enumtypid=t.oid where t.typname='NotificationEventType' order by e.enumsortorder",
  );

  for (const row of result.rows) {
    process.stdout.write(`${row.enumlabel}\n`);
  }

  await client.end();
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
