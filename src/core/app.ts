import { envString } from './helpers/env.helper.js';

export type AppRuntime = 'web' | 'cli' | 'cron' | 'worker';

export const APP_NAME = 'engofy';

export const APP_TAG = envString('GIT_COMMIT', 'unknown');
