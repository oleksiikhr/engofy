import type { INestApplicationContext } from '@nestjs/common';
import { closeOnce } from './close-once.helper.js';

describe('closeOnce', () => {
  it('calls app.close() only once across repeated callers', async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const app = { close } as unknown as INestApplicationContext;

    const closeApp = closeOnce(app);
    await Promise.all([closeApp(), closeApp(), closeApp()]);
    await closeApp();

    expect(close).toHaveBeenCalledTimes(1);
  });

  it('re-hands the same rejection to a later caller without re-closing', async () => {
    const boom = new Error('teardown failed');
    const close = vi.fn().mockRejectedValue(boom);
    const app = { close } as unknown as INestApplicationContext;

    const closeApp = closeOnce(app);

    await expect(closeApp()).rejects.toBe(boom);
    await expect(closeApp()).rejects.toBe(boom);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when the app never booted', async () => {
    const closeApp = closeOnce(undefined);
    await expect(closeApp()).resolves.toBeUndefined();
  });
});
