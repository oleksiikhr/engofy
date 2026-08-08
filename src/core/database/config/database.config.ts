import { registerAs } from '@nestjs/config';
import { envNumber } from '../../helpers/env.helper.js';

export default registerAs('database', () => ({
  slowQueryThreshold: envNumber('SLOW_QUERY_THRESHOLD', 2000),
}));
