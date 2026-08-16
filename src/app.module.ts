import { MikroOrmModule } from '@mikro-orm/nestjs';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { SentryModule } from '@sentry/nestjs/setup';
import type { AppRuntime } from './core/app.js';
import AppConfig from './core/config/app.config.js';
import SwaggerConfig from './core/config/swagger.config.js';
import DatabaseConfig from './core/database/config/database.config.js';
import { databaseFactory } from './core/database/mikro-orm.factory.js';
import { Environment, getEnvironment } from './core/enums/environment.enum.js';
import { LoggerModule } from './core/logger/logger.module.js';
import { PgBossModule } from './core/queue/pg-boss.module.js';
import { RedisModule } from './core/redis/redis.module.js';
import { CliModule } from './entrypoints/cli/cli.module.js';
import { CronModule } from './entrypoints/cron/cron.module.js';
import { WebModule } from './entrypoints/web/web.module.js';
import { WorkerModule } from './entrypoints/worker/worker.module.js';

@Module({})
// biome-ignore lint/complexity/noStaticOnlyClass: NestJS dynamic module pattern (forRoot/forFeature)
export class AppModule {
  static common(runtime: AppRuntime) {
    const env = getEnvironment();

    return {
      module: AppModule,
      imports: [
        SentryModule.forRoot(),
        ConfigModule.forRoot({
          cache: true,
          load: [AppConfig, SwaggerConfig],
          envFilePath: [
            `.env.${env}.local`,
            `.env.${env}`,
            '.env.local',
            '.env',
          ],
          ignoreEnvFile: env === Environment.Production,
        }),
        MikroOrmModule.forRootAsync({
          imports: [ConfigModule.forFeature(DatabaseConfig)],
          inject: [DatabaseConfig.KEY],
          driver: PostgreSqlDriver,
          useFactory: databaseFactory,
        }),
        CqrsModule.forRoot(),
        LoggerModule.forRuntime(runtime),
        PgBossModule.forRuntime(runtime),
        RedisModule,
      ],
    };
  }

  static web() {
    const common = AppModule.common('web');

    return {
      ...common,
      imports: [...common.imports, WebModule.forRoot()],
    };
  }

  static cli(command?: string) {
    const common = AppModule.common('cli');

    return {
      ...common,
      imports: [...common.imports, CliModule.forCommand(command)],
    };
  }

  static cron() {
    const common = AppModule.common('cron');

    return {
      ...common,
      imports: [...common.imports, CronModule],
    };
  }

  static worker(queues: string[] = []) {
    const common = AppModule.common('worker');

    return {
      ...common,
      imports: [...common.imports, WorkerModule.forQueues(queues)],
    };
  }
}
