import { initializeSentry } from '@gitroom/nestjs-libraries/sentry/initialize.sentry';
initializeSentry('workers');

import { NestFactory } from '@nestjs/core';

import { MicroserviceOptions } from '@nestjs/microservices';
import { BullMqServer } from '@gitroom/nestjs-libraries/bull-mq-transport-new/strategy';

import { AppModule } from './app/app.module';
import { StructuredLogger } from '@gitroom/nestjs-libraries/logging/structured.logger';

async function start() {
  process.env.IS_WORKER = 'true';
  process.env.SERVICE_NAME = 'workers';

  const logger = new StructuredLogger();

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      strategy: new BullMqServer(),
      logger,
    }
  );

  await app.listen();
}

start();
