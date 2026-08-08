import { Logger } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { injectOrm } from '../../../test/helpers/orm.helper.js';
import { CronJobHost } from './cron-job-host.js';

vi.mock('@sentry/nestjs', () => ({ captureException: vi.fn() }));

class TestCron extends CronJobHost {
  constructor(private readonly work: () => Promise<void>) {
    super();
  }

  async trigger(): Promise<void> {
    return this.handle();
  }

  protected async execute(): Promise<void> {
    await this.work();
  }
}

function buildCron(work: () => Promise<void>) {
  return injectOrm(new TestCron(work));
}

// draining is a one-way, module-level flag — once any test flips it, it stays
// flipped for the rest of this file's statically-imported module instance.
// Tests that need draining=false (or need to flip it without leaking into
// other tests) load a fresh module instance instead of the static import above.
async function freshCronJobHost() {
  vi.resetModules();
  const fresh = await import('./cron-job-host.js');

  class IsolatedTestCron extends fresh.CronJobHost {
    constructor(private readonly work: () => Promise<void>) {
      super();
    }

    async trigger(): Promise<void> {
      return this.handle();
    }

    protected async execute(): Promise<void> {
      await this.work();
    }
  }

  return {
    waitForCronTicksToDrain: fresh.waitForCronTicksToDrain,
    buildCron: (work: () => Promise<void>) =>
      injectOrm(new IsolatedTestCron(work)),
  };
}

describe('CronJobHost', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('runs execute() without capturing anything on success', async () => {
    const work = vi.fn().mockResolvedValue(undefined);
    const cron = buildCron(work);

    await cron.trigger();

    expect(work).toHaveBeenCalledOnce();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('captures the error in Sentry, logs it, and rethrows on failure', async () => {
    const errorSpy = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const error = new Error('boom');
    const work = vi.fn().mockRejectedValue(error);
    const cron = buildCron(work);

    await expect(cron.trigger()).rejects.toThrow(error);

    expect(Sentry.captureException).toHaveBeenCalledWith(error);
    expect(errorSpy).toHaveBeenCalledWith({ err: error }, 'Cron failed');
  });

  it('waitForCronTicksToDrain resolves immediately when no cron is running', async () => {
    const { waitForCronTicksToDrain: drain } = await freshCronJobHost();

    await expect(drain()).resolves.toBeUndefined();
  });

  it('waitForCronTicksToDrain waits for an in-flight tick to finish', async () => {
    const { buildCron: build, waitForCronTicksToDrain: drain } =
      await freshCronJobHost();

    let releaseWork: () => void = () => undefined;
    const work = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          releaseWork = resolve;
        }),
    );
    const cron = build(work);

    const trigger = cron.trigger();
    const drainPromise = drain();
    let drained = false;
    void drainPromise.then(() => {
      drained = true;
    });

    await Promise.resolve();
    expect(drained).toBe(false);

    releaseWork();
    await trigger;
    await drainPromise;

    expect(drained).toBe(true);
  });

  it('waitForCronTicksToDrain rejects if the in-flight tick failed', async () => {
    const { buildCron: build, waitForCronTicksToDrain: drain } =
      await freshCronJobHost();
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    const error = new Error('boom');
    const work = vi.fn().mockRejectedValue(error);
    const cron = build(work);

    const trigger = cron.trigger().catch(() => undefined);
    const drainPromise = drain();

    await expect(drainPromise).rejects.toThrow(error);
    await trigger;
  });

  it('rejects new ticks once draining has started, but keeps draining in-flight ones', async () => {
    const { buildCron: build, waitForCronTicksToDrain: drain } =
      await freshCronJobHost();

    let releaseWork: () => void = () => undefined;
    const work = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          releaseWork = resolve;
        }),
    );
    const cron = build(work);

    const firstTrigger = cron.trigger();
    const drainPromise = drain();

    await Promise.resolve();

    await cron.trigger(); // second tick, started after draining began

    expect(work).toHaveBeenCalledOnce();

    releaseWork();
    await firstTrigger;
    await drainPromise;
  });
});
