const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('pg');

dotenv.config({ path: path.resolve(process.cwd(), `.env.${process.env.NODE_ENV || 'development'}`) });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function stripQuotes(value) {
  if (!value) return value;
  return value.replace(/^"|"$/g, '');
}

async function main() {
  const rawDatabaseUrl = stripQuotes(process.env.DATABASE_URL);
  if (!rawDatabaseUrl) {
    throw new Error('DATABASE_URL missing (check your .env files)');
  }

  const base = new URL(rawDatabaseUrl);
  const admin = new URL(base.toString());
  admin.pathname = '/postgres';

  const dbs = ['Academia_groupflow', 'Academia_groupflow_shadow'];

  const client = new Client({ connectionString: admin.toString() });
  await client.connect();

  for (const db of dbs) {
    try {
      await client.query(`CREATE DATABASE "${db}"`);
      console.log(`created ${db}`);
    } catch (e) {
      if (e && e.code === '42P04') {
        console.log(`exists ${db}`);
      } else {
        throw e;
      }
    }
  }

  await client.end();
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
