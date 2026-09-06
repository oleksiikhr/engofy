import { registerAs } from '@nestjs/config';
import { envNumber, envString } from '../helpers/env.helper.js';

export default registerAs('redis', () => ({
  host: envString('REDIS_HOST', '127.0.0.1'),
  port: envNumber('REDIS_PORT', 6379),
  password: envString('REDIS_PASSWORD'),
  // Logical DB index. Defaults to 0; the test env sets it to a dedicated
  // index so the integration suite can `FLUSHDB` between tests without
  // touching anything real (T6).
  db: envNumber('REDIS_DB', 0),
}));
