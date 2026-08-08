import { MikroORM } from '@mikro-orm/core';
import { Inject, Logger } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { withRequestContext } from '../../core/database/helpers/request-context.helper.js';

// @nestjs/schedule has no shutdown hook of its own, so a SIGTERM arriving mid-tick
// races MikroOrmCoreModule's onApplicationShutdown (which closes the pool immediately).
// cron.ts awaits this before calling app.close() so an in-flight tick finishes first.
const inFlightTicks = new Set<Promise<unknown>>();

// Set before snapshotting inFlightTicks so handle() stops admitting new ticks
// the instant a drain starts — otherwise a tick scheduled during the drain
// window would run unwaited-for and hit the same shutdown race we're fixing.
let draining = false;

export async function waitForCronTicksToDrain(): Promise<void> {
  draining = true;

  const results = await Promise.allSettled([...inFlightTicks]);
  const rejected = results.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );

  if (rejected) {
    throw rejected.reason;
  }
}

export abstract class CronJobHost {
  protected readonly logger = new Logger(this.constructor.name);

  @Inject(MikroORM)
  protected readonly orm!: MikroORM;

  protected async handle(): Promise<void> {
    if (draining) {
      return;
    }

    const tick = this.tick();
    inFlightTicks.add(tick);

    try {
      await tick;
    } finally {
      inFlightTicks.delete(tick);
    }
  }

  private async tick(): Promise<void> {
    try {
      await withRequestContext(this.orm.em, () => this.execute());
    } catch (err) {
      Sentry.captureException(err);

      this.logger.error({ err }, 'Cron failed');

      throw err;
    }
  }

  protected abstract execute(): Promise<void>;
}
