import { registerAs } from '@nestjs/config';
import { envEnum } from '../helpers/env.helper.js';

export default registerAs('logger', () => ({
  level: envEnum(
    'LOG_LEVEL',
    ['fatal', 'error', 'warn', 'info', 'debug', 'trace'],
    'info',
  ),
}));
