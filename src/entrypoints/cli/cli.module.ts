import type { DynamicModule, Type } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { MigrateCliModule } from './migrate/migrate-cli.module.js';
import { PostCliModule } from './post/post-cli.module.js';
import { QueueCliModule } from './queue/queue-cli.module.js';
import { SentryCliModule } from './sentry/sentry-cli.module.js';

const COMMAND_MODULES: Record<string, Type> = {
  sentry: SentryCliModule,
  migrate: MigrateCliModule,
  queue: QueueCliModule,
  post: PostCliModule,
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
