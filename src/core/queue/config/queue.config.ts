import { registerAs } from '@nestjs/config';
import { envNumber, envString } from '../../helpers/env.helper.js';

export default registerAs('queue', () => ({
  // pg-boss needs a session connection (LISTEN/NOTIFY), which a transaction
  // pooler does not give. `QUEUE_DB_HOST`/`QUEUE_DB_PORT` point it at the direct
  // endpoint while MikroORM uses a pooled one; unset, both share `MIKRO_ORM_*`.
  host: envString('QUEUE_DB_HOST') ?? envString('MIKRO_ORM_HOST', '127.0.0.1'),
  port: envNumber('QUEUE_DB_PORT') ?? envNumber('MIKRO_ORM_PORT', 5432),
  // Same connection as MikroORM — read the same `MIKRO_ORM_*` env vars and keep
  // the fallback defaults identical to `core/database/mikro-orm.setup.ts` so an
  // env-less local run points both at the same DB.
  database: envString('MIKRO_ORM_DB_NAME', 'engofy'),
  user: envString('MIKRO_ORM_USER', 'engofy'),
  password: envString('MIKRO_ORM_PASSWORD', 'engofy'),
  poolMax: envNumber('QUEUE_POOL_MAX', 5),
}));
