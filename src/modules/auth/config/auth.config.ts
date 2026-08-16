import { registerAs } from '@nestjs/config';
import { envNumber, envString } from '../../../core/helpers/env.helper.js';

export default registerAs('auth', () => ({
  googleClientId: envString('GOOGLE_CLIENT_ID', ''),
  challengeTtlMs: envNumber('AUTH_CHALLENGE_TTL_MS', 15 * 60 * 1000),
  otpMaxAttempts: envNumber('AUTH_OTP_MAX_ATTEMPTS', 5),
  requestLimitPerEmail: envNumber('AUTH_REQUEST_LIMIT_PER_EMAIL', 5),
  requestLimitWindowMs: envNumber(
    'AUTH_REQUEST_LIMIT_WINDOW_MS',
    60 * 60 * 1000,
  ),
  sessionTtlMs: envNumber('AUTH_SESSION_TTL_MS', 30 * 24 * 60 * 60 * 1000),
  sessionRefreshThresholdMs: envNumber(
    'AUTH_SESSION_REFRESH_THRESHOLD_MS',
    15 * 24 * 60 * 60 * 1000,
  ),
  sessionCookieName: envString('AUTH_SESSION_COOKIE_NAME', '__Host-session'),
}));
