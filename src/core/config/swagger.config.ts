import { registerAs } from '@nestjs/config';
import { APP_NAME, APP_TAG } from '../app.js';
import { envString } from '../helpers/env.helper.js';

export default registerAs('swagger', () => ({
  title: envString('SWAGGER_TITLE', APP_NAME),
  version: envString('SWAGGER_VERSION', APP_TAG),
  path: envString('SWAGGER_PATH', '_swagger'),
}));
