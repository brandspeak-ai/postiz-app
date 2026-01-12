import { initializeSentry } from '@gitroom/nestjs-libraries/sentry/initialize.sentry';
initializeSentry('cron');

import { NestFactory } from '@nestjs/core';
import { CronModule } from './cron.module';
import { StructuredLogger } from '@gitroom/nestjs-libraries/logging/structured.logger';

async function start() {
  process.env.SERVICE_NAME = 'cron';

  const logger = new StructuredLogger();

  await NestFactory.createApplicationContext(CronModule, { logger });
}

start();
