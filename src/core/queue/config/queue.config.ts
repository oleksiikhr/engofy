import { registerAs } from '@nestjs/config';
import { envNumber, envString } from '../../helpers/env.helper.js';

export default registerAs('queue', () => ({
  host: envString('MIKRO_ORM_HOST', '127.0.0.1'),
  port: envNumber('MIKRO_ORM_PORT', 5432),
  // Same connection as MikroORM — read the same `MIKRO_ORM_*` env vars and keep
  // the fallback defaults identical to `core/database/mikro-orm.setup.ts` so an
  // env-less local run points both at the same DB.
  database: envString('MIKRO_ORM_DB_NAME', 'engofy'),
  user: envString('MIKRO_ORM_USER', 'engofy'),
  password: envString('MIKRO_ORM_PASSWORD', 'engofy'),
  poolMax: envNumber('QUEUE_POOL_MAX', 5),
}));
