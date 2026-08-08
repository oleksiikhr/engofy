import { registerAs } from '@nestjs/config';
import { envNumber, envString } from '../helpers/env.helper.js';

export default registerAs('app', () => ({
  port: envNumber('PORT', 8080),
  host: envString('HOST', '0.0.0.0'),
  publicUrl: envString('PUBLIC_URL'),
}));
