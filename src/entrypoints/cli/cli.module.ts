import type { DynamicModule, Type } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { ContentCliModule } from './content/content-cli.module.js';
import { MigrateCliModule } from './migrate/migrate-cli.module.js';
import { QueueCliModule } from './queue/queue-cli.module.js';
import { SentryCliModule } from './sentry/sentry-cli.module.js';

const COMMAND_MODULES: Record<string, Type> = {
  sentry: SentryCliModule,
  migrate: MigrateCliModule,
  queue: QueueCliModule,
  content: ContentCliModule,
};

@Module({})
// biome-ignore lint/complexity/noStaticOnlyClass: NestJS dynamic module pattern (forRoot/forFeature)
export class CliModule {
  static forCommand(command?: string): DynamicModule {
    const selected =
      command && Object.hasOwn(COMMAND_MODULES, command)
        ? [COMMAND_MODULES[command]]
        : Object.values(COMMAND_MODULES);

    return {
      module: CliModule,
      imports: selected,
    };
  }
}
