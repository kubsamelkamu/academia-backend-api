import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrapWorker() {
  const logger = new Logger('Worker');

  await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  logger.log('Worker started (Bull processors active)');
}

bootstrapWorker().catch((err) => {
  console.error('Worker failed to start', err);
  process.exit(1);
});
