import { RequestContext } from '@mikro-orm/core';
import {
  shouldSkipRequestContext,
  withRequestContext,
} from './request-context.helper.js';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('shouldSkipRequestContext', () => {
  it('is true under NODE_ENV=test (the suite default)', () => {
    expect(shouldSkipRequestContext()).toBe(true);
  });

  it('is false outside the test environment', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(shouldSkipRequestContext()).toBe(false);
  });
});

describe('withRequestContext', () => {
  it('runs the callback directly, without RequestContext.create, when skipping', async () => {
    const create = vi.spyOn(RequestContext, 'create');

    await expect(
      withRequestContext({} as never, async () => 'ok'),
    ).resolves.toBe('ok');
    expect(create).not.toHaveBeenCalled();
  });

  it('wraps the callback in RequestContext.create when not skipping', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const create = vi
      .spyOn(RequestContext, 'create')
      .mockImplementation((_em, fn) => fn() as never);
    const em = {} as never;
    const cb = async () => 'wrapped';

    await expect(withRequestContext(em, cb)).resolves.toBe('wrapped');
    expect(create).toHaveBeenCalledWith(em, cb);
  });
});
