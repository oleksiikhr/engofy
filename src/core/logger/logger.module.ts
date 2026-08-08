import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import type { AppRuntime } from '../app.js';
import LoggerConfig from './logger.config.js';
import { loggerFactory } from './logger.factory.js';

@Module({})
// biome-ignore lint/complexity/noStaticOnlyClass: NestJS dynamic module pattern (forRoot/forFeature)
export class LoggerModule {
  static forRuntime(runtime: AppRuntime) {
    return {
      module: LoggerModule,
      imports: [
        PinoLoggerModule.forRootAsync({
          imports: [ConfigModule.forFeature(LoggerConfig)],
          inject: [LoggerConfig.KEY],
          useFactory: (config: Parameters<typeof loggerFactory>[0]) =>
            loggerFactory(config, runtime),
        }),
      ],
    };
  }
}
