import type { MikroOrmModuleOptions } from '@mikro-orm/nestjs';
import type { ConfigType } from '@nestjs/config';
import DatabaseConfig from './config/database.config.js';
import { shouldSkipRequestContext } from './helpers/request-context.helper.js';
import { MikroOrmLogger } from './mikro-orm.logger.js';
import mikroOrmConfig from './mikro-orm.setup.js';

export function databaseFactory(
  config: ConfigType<typeof DatabaseConfig>,
): MikroOrmModuleOptions {
  return {
    ...mikroOrmConfig,
    registerRequestContext: !shouldSkipRequestContext(),
    loggerFactory: (options) =>
      new MikroOrmLogger(config.slowQueryThreshold, options),
  };
}
