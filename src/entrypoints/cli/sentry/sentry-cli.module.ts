import { Module } from '@nestjs/common';
import { SentryCommand } from './sentry.command.js';
import { SentryTestCommand } from './sentry-test.command.js';

@Module({
  providers: [SentryCommand, SentryTestCommand],
})
export class SentryCliModule {}
