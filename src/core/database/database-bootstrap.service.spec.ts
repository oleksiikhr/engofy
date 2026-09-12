import type { MikroORM } from '@mikro-orm/postgresql';
import { describe, expect, it, vi } from 'vitest';
import { DatabaseBootstrapService } from './database-bootstrap.service.js';

describe('DatabaseBootstrapService', () => {
  it('opens the ORM connection on application bootstrap', async () => {
    const connect = vi.fn().mockResolvedValue(undefined);
    const service = new DatabaseBootstrapService({
      connect,
    } as unknown as MikroORM);

    await service.onApplicationBootstrap();

    expect(connect).toHaveBeenCalledOnce();
  });

  it('propagates a connection failure so the process fails fast at startup', async () => {
    const connect = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const service = new DatabaseBootstrapService({
      connect,
    } as unknown as MikroORM);

    await expect(service.onApplicationBootstrap()).rejects.toThrow(
      'ECONNREFUSED',
    );
  });
});
