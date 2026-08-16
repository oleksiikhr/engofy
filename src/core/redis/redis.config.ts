import { registerAs } from '@nestjs/config';
import { envNumber, envString } from '../helpers/env.helper.js';

export default registerAs('redis', () => ({
  host: envString('REDIS_HOST', '127.0.0.1'),
  port: envNumber('REDIS_PORT', 6379),
  password: envString('REDIS_PASSWORD'),
}));
