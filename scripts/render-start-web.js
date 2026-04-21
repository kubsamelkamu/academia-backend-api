const { spawnSync } = require('node:child_process');

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }

  return result.status ?? 1;
}

function main() {
  const shouldRunMigrations =
    (process.env.RUN_PRISMA_MIGRATIONS ?? '').toLowerCase() === 'true';
  const shouldRunSeeds = (process.env.RUN_DB_SEED ?? '').toLowerCase() === 'true';

  if (shouldRunMigrations) {
    console.log('[render] Running Prisma migrations (prisma migrate deploy)...');
    const status = run('npx', [
      'prisma',
      'migrate',
      'deploy',
      '--config',
      'src/prisma/prisma.config.ts',
    ]);
    if (status !== 0) {
      console.error(`[render] Prisma migrate deploy failed (exit ${status}).`);
      process.exit(status);
    }
  } else {
    console.log('[render] Skipping migrations (RUN_PRISMA_MIGRATIONS != true).');
  }

  if (shouldRunSeeds) {
    console.log('[render] Running database seed...');
    const seedStatus = run('node', ['dist/src/prisma/seeds/main.seed.js']);
    if (seedStatus !== 0) {
      console.error(`[render] Seed failed (exit ${seedStatus}).`);
      process.exit(seedStatus);
    }
  } else {
    console.log('[render] Skipping seed (RUN_DB_SEED != true).');
  }

  console.log('[render] Starting web server...');
  const serverStatus = run('node', ['dist/src/main.js']);
  process.exit(serverStatus);
}

main();
