import { registerAs } from '@nestjs/config';
import { envNumber } from '../helpers/env.helper.js';

// Global request rate limit at the web edge (PLAN.md §7). Enforced per client
// IP by `ThrottlerGuard`; the counters live in Redis so every instance shares
// one window.
export default registerAs('throttler', () => ({
  ttlMs: envNumber('THROTTLE_TTL_MS', 60_000),
  limit: envNumber('THROTTLE_LIMIT', 300),
}));
