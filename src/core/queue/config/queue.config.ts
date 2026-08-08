import { registerAs } from '@nestjs/config';
import { envNumber, envString } from '../../helpers/env.helper.js';

export default registerAs('queue', () => ({
  host: envString('MIKRO_ORM_HOST', '127.0.0.1'),
  port: envNumber('MIKRO_ORM_PORT', 5432),
  database: envString('MIKRO_ORM_DB_NAME', 'engofy'),
  user: envString('MIKRO_ORM_USER', 'postgres'),
  password: envString('MIKRO_ORM_PASSWORD', 'postgres'),
  poolMax: envNumber('QUEUE_POOL_MAX', 5),
}));
