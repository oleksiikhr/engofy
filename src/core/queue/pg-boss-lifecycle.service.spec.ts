import type { PgBoss } from 'pg-boss';
import { PgBossLifecycleService } from './pg-boss-lifecycle.service.js';

describe('PgBossLifecycleService', () => {
  it('stops pg-boss gracefully, waiting up to the configured timeout', async () => {
    const stop = vi.fn().mockResolvedValue(undefined);
    const service = new PgBossLifecycleService(
      { stop } as unknown as PgBoss,
      {
        shutdownTimeoutMs: 90_000,
      } as never,
    );

    await service.onApplicationShutdown();

    expect(stop).toHaveBeenCalledWith({ graceful: true, timeout: 90_000 });
  });
});
